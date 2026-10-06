/**
 * Sticky API-key failover and health tracking engine.
 *
 * Adapted from battle-tested production provider failover logic:
 * - A provider keeps using its current working key so provider-side prompt caches stay warm.
 * - The index advances only after that key encounters a rate limit or failure.
 * - Streaming output guard prevents duplicate outputs and double-billing on mid-stream transport failures.
 * - AbortError guard ensures user cancellations never cause unnecessary key failovers.
 */

export type KeyHealthStatus = 'untested' | 'working' | 'rate-limited' | 'failed';

export interface KeyPoolState {
  provider: string;
  keys: string[];
  currentIndex: number;
  currentKey: string;
  status: KeyHealthStatus[];
}

export interface KeyPoolSummary {
  provider: string;
  totalKeys: number;
  workingCount: number;
  rateLimitedCount: number;
  failedCount: number;
  currentIndex: number;
  statuses: KeyHealthStatus[];
}

/** Each configured key gets this many attempts before the sticky selection advances */
export const KEY_ATTEMPTS_PER_KEY = 2;

export const STREAM_OUTPUT_GUARD = Symbol('streamOutputGuard');

export interface StreamOutputGuardState {
  outputStarted: boolean;
  partial: string;
}

const apiKeyIndices: Record<string, number> = {};
const apiKeyStatus: Record<string, KeyHealthStatus[]> = {};
const keyAttemptCounters: Record<string, number> = {};
const configuredKeyPools: Record<string, string[]> = {};

/**
 * Normalizes string, string[], or JSON array representations of API keys into a clean string array.
 */
export function normalizeKeyPool(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw
          .map((k) => (typeof k === 'string' ? k.trim() : ''))
          .filter((k) => k.length > 0)
      ),
    ];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeKeyPool(parsed);
        }
      } catch {
        // Fall back to newline or comma splitting
      }
    }
    // Support newline-delimited or comma-delimited keys
    if (trimmed.includes('\n') || trimmed.includes(',')) {
      const split = trimmed.split(/[\r\n,]+/).map((k) => k.trim()).filter((k) => k.length > 0);
      return [...new Set(split)];
    }
    return [trimmed];
  }
  return [];
}

/**
 * Registers or updates the key pool for a provider.
 */
export function setConfiguredKeyPool(provider: string, keys: unknown): string[] {
  const normalized = normalizeKeyPool(keys);
  configuredKeyPools[provider] = normalized;

  // Reconcile status array length
  const existingStatuses = apiKeyStatus[provider] || [];
  const newStatuses: KeyHealthStatus[] = normalized.map((_, i) => existingStatuses[i] || 'untested');
  apiKeyStatus[provider] = newStatuses;

  // Ensure index remains in bounds
  if (
    !Number.isInteger(apiKeyIndices[provider]) ||
    apiKeyIndices[provider] < 0 ||
    apiKeyIndices[provider] >= normalized.length
  ) {
    apiKeyIndices[provider] = 0;
  }
  keyAttemptCounters[provider] = 0;

  return normalized;
}

/**
 * Get the currently configured key pool for a provider.
 */
export function getConfiguredKeyPool(provider: string): string[] {
  return configuredKeyPools[provider] || [];
}

/**
 * Lazy pool initialization with bounds checking.
 */
export function initializeApiKeyPool(provider: string, normalizedKeys: string[]): KeyPoolState {
  if (normalizedKeys.length > 0) {
    configuredKeyPools[provider] = normalizedKeys;
  }
  const keys = normalizedKeys.length > 0 ? normalizedKeys : (configuredKeyPools[provider] || []);

  if (!apiKeyStatus[provider] || apiKeyStatus[provider].length !== keys.length) {
    apiKeyStatus[provider] = new Array(keys.length).fill('untested');
  }

  if (
    !Number.isInteger(apiKeyIndices[provider]) ||
    apiKeyIndices[provider] < 0 ||
    apiKeyIndices[provider] >= keys.length
  ) {
    apiKeyIndices[provider] = 0;
  }

  const currentIndex = keys.length > 0 ? apiKeyIndices[provider] : 0;
  const currentKey = keys.length > 0 ? keys[currentIndex] : '';

  return {
    provider,
    keys,
    currentIndex,
    currentKey,
    status: apiKeyStatus[provider] || [],
  };
}

/**
 * Returns the current sticky key. Selection itself never rotates the pool.
 */
export function getNextKey(provider: string, candidateKeys?: unknown): KeyPoolState {
  const keys = candidateKeys !== undefined
    ? normalizeKeyPool(candidateKeys)
    : (configuredKeyPools[provider] || []);

  return initializeApiKeyPool(provider, keys);
}

/**
 * A successful key remains selected for subsequent requests.
 */
export function markKeySuccess(provider: string, keyIndex?: number): void {
  const keys = configuredKeyPools[provider] || [];
  const idx = keyIndex !== undefined ? keyIndex : (apiKeyIndices[provider] ?? 0);

  if (apiKeyStatus[provider] && idx >= 0 && idx < apiKeyStatus[provider].length) {
    apiKeyStatus[provider][idx] = 'working';
  }
  if (Number.isInteger(idx) && idx >= 0 && idx < keys.length) {
    apiKeyIndices[provider] = idx;
  }
  keyAttemptCounters[provider] = 0;
}

/**
 * Determines whether an error should trigger a key failover.
 * Explicit caller cancellations (AbortError / APIUserAbortError) stop failover.
 */
export function shouldFailover(error: unknown): boolean {
  if (!error) return true;
  const err = error as { name?: string; constructor?: { name?: string }; cause?: { name?: string; code?: unknown }; code?: unknown };
  const names = [err.name, err.constructor?.name, err.cause?.name].filter(Boolean) as string[];
  const codes = [err.code, err.cause?.code].filter(Boolean).map((c) => String(c).toUpperCase());

  if (names.some((name) => name === 'AbortError' || name === 'APIUserAbortError')) {
    return false;
  }
  if (codes.some((code) => ['ABORT_ERR', 'ERR_CANCELED', 'ERR_CANCELLED'].includes(code))) {
    return false;
  }

  return true;
}

/**
 * Rate-limit vs failure classification regex pattern.
 */
export const RATE_LIMIT_PATTERN = /rate|quota|credit|billing|exhaust|insufficient|balance|429/i;

/**
 * A failed key advances the sticky selection after per-key attempt budget is exhausted.
 */
export function markKeyFailure(provider: string, keyIndex: number, error: unknown, forceAdvance = false): boolean {
  if (!shouldFailover(error)) {
    return false;
  }

  const currentAttempts = (keyAttemptCounters[provider] || 0) + 1;
  keyAttemptCounters[provider] = currentAttempts;

  if (apiKeyStatus[provider] && keyIndex >= 0 && keyIndex < apiKeyStatus[provider].length) {
    const errorText = String((error as { message?: string })?.message || error || '').toLowerCase();
    const isRateLimit = RATE_LIMIT_PATTERN.test(errorText);
    apiKeyStatus[provider][keyIndex] = isRateLimit ? 'rate-limited' : 'failed';
  }

  const totalKeys = configuredKeyPools[provider]?.length || apiKeyStatus[provider]?.length || 0;
  if (totalKeys <= 1) {
    return false;
  }

  if (forceAdvance || currentAttempts >= KEY_ATTEMPTS_PER_KEY) {
    keyAttemptCounters[provider] = 0;
    apiKeyIndices[provider] = (keyIndex + 1) % totalKeys;
    return true; // Advanced to next key
  }

  return false; // Retrying same key
}

/**
 * Retrieve current key pool summary and statuses for UI.
 */
export function getKeyPoolSummary(provider: string): KeyPoolSummary {
  const keys = configuredKeyPools[provider] || [];
  const statuses = apiKeyStatus[provider] || [];
  let workingCount = 0;
  let rateLimitedCount = 0;
  let failedCount = 0;

  for (const st of statuses) {
    if (st === 'working') workingCount++;
    else if (st === 'rate-limited') rateLimitedCount++;
    else if (st === 'failed') failedCount++;
  }

  return {
    provider,
    totalKeys: keys.length,
    workingCount,
    rateLimitedCount,
    failedCount,
    currentIndex: apiKeyIndices[provider] ?? 0,
    statuses,
  };
}

/**
 * Resets pool indices and status (e.g. for testing or manual retry button).
 */
export function resetKeyPool(provider?: string): void {
  if (provider) {
    apiKeyIndices[provider] = 0;
    keyAttemptCounters[provider] = 0;
    if (apiKeyStatus[provider]) {
      apiKeyStatus[provider].fill('untested');
    }
  } else {
    for (const key of Object.keys(apiKeyIndices)) {
      apiKeyIndices[key] = 0;
      keyAttemptCounters[key] = 0;
      if (apiKeyStatus[key]) {
        apiKeyStatus[key].fill('untested');
      }
    }
  }
}

/**
 * Fixes unbalanced <think> or <thinking> tags on interrupted streams.
 */
export function closeUnbalancedReasoningTag(text: string): string {
  if (!text || typeof text !== 'string') return text;
  const opens = (text.match(/<think(?:ing)?>/gi) || []).length;
  const closes = (text.match(/<\/think(?:ing)?>/gi) || []).length;
  if (opens <= closes) return text;

  const openTags = text.match(/<think(?:ing)?>/gi) || [];
  const lastOpen = openTags[openTags.length - 1] || '';
  const tagName = /ing>$/i.test(lastOpen) ? 'thinking' : 'think';
  let closed = text;
  for (let i = closes; i < opens; i++) {
    closed += `\n</${tagName}>\n`;
  }
  return closed;
}

/**
 * Wraps onToken callback to track whether output has started streaming.
 */
export function withStreamingOutputGuard<
  T extends { stream?: boolean; onToken?: (token: string) => unknown }
>(settings: T): T & { [STREAM_OUTPUT_GUARD]?: StreamOutputGuardState } {
  if (!settings?.stream || typeof settings.onToken !== 'function') return settings;

  const guard: StreamOutputGuardState = { outputStarted: false, partial: '' };
  const originalOnToken = settings.onToken;

  return {
    ...settings,
    [STREAM_OUTPUT_GUARD]: guard,
    onToken(token: string) {
      if (token) {
        guard.outputStarted = true;
        guard.partial += token;
      }
      return originalOnToken(token);
    },
  };
}

/**
 * Prevents key failover after streaming output has already started.
 * Returns partial text instead of retrying on another key.
 */
export function stopFailoverAfterStreamingOutput(
  provider: string,
  settings: unknown,
  error: unknown
): string | null {
  const guard = (settings as Record<typeof STREAM_OUTPUT_GUARD, StreamOutputGuardState> | undefined)?.[
    STREAM_OUTPUT_GUARD
  ];
  if (!guard?.outputStarted) return null;

  const partial = closeUnbalancedReasoningTag(guard.partial || '');
  console.warn(
    `[key-pool] ${provider} stream interrupted after output started (${
      (error as Error)?.message || error
    }); finalizing with ${partial.length}-char partial reply instead of failing over to another key.`
  );
  return partial;
}
