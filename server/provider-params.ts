/**
 * Provider-specific reasoning and thinking parameter resolvers.
 *
 * Adapted from llm-providers.js lines 509-659, 679-729:
 * - Gemini thinking levels (v3+) and thinking budgets (v2.5)
 * - NVIDIA NIM chat_template_kwargs and reasoning_effort mappings
 * - Unified reasoning effort levels resolution
 */

export const REASONING_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh'] as const;
export type ReasoningEffortLevel = (typeof REASONING_EFFORT_LEVELS)[number];

export interface ProviderSettingsLike {
  reasoningEffort?: string;
  thinkingLevel?: string;
  maxTokens?: number;
  [key: string]: unknown;
}

export function effectiveReasoningEffort(
  settings?: ProviderSettingsLike | null,
  fallback = 'high'
): ReasoningEffortLevel {
  const value = String(settings?.reasoningEffort || settings?.thinkingLevel || '').trim().toLowerCase();
  if ((REASONING_EFFORT_LEVELS as readonly string[]).includes(value)) {
    return value as ReasoningEffortLevel;
  }
  const fb = String(fallback || '').trim().toLowerCase();
  return (REASONING_EFFORT_LEVELS as readonly string[]).includes(fb)
    ? (fb as ReasoningEffortLevel)
    : 'high';
}

export function rawReasoningEffort(settings?: ProviderSettingsLike | null): string {
  const value = String(settings?.reasoningEffort || settings?.thinkingLevel || '').trim().toLowerCase();
  return (REASONING_EFFORT_LEVELS as readonly string[]).includes(value) ? value : '';
}

export function normalizeGeminiModelId(modelId: string): string {
  return String(modelId || '').trim().replace(/^models\//i, '');
}

const GEMINI_THINKING_BUDGETS: Record<string, Record<string, number>> = {
  pro: { low: 2048, medium: 8192, high: 24576 },
  flash: { low: 1024, medium: 8192, high: 24576 },
  'flash-lite': { low: 512, medium: 8192, high: 24576 },
};

export function resolveGeminiThinkingConfig(
  modelId: string,
  settings?: ProviderSettingsLike | null
): { thinkingLevel?: string; thinkingBudget?: number } | null {
  const id = normalizeGeminiModelId(modelId).toLowerCase();
  const effort = rawReasoningEffort(settings);

  if (id.includes('embedding') || id.includes('aqa')) return null;

  if (/^gemma-?4/.test(id)) {
    if (effort === 'low') return { thinkingLevel: 'MINIMAL' };
    return { thinkingLevel: 'HIGH' };
  }

  if (/^(gemma|learnlm|imagen|veo|nano-banana)/.test(id) || /(^|-)image($|-)/.test(id)) {
    return null;
  }

  const versionMatch = id.match(/^gemini-(\d+)(?:\.(\d+))?-/);
  let major: number;
  let minor = 0;
  if (versionMatch) {
    major = parseInt(versionMatch[1], 10);
    minor = versionMatch[2] !== undefined ? parseInt(versionMatch[2], 10) : 0;
  } else if (id.startsWith('gemini-')) {
    major = 2;
    minor = 5;
  } else {
    return null;
  }

  const family = id.includes('flash-lite')
    ? 'flash-lite'
    : id.includes('flash')
      ? 'flash'
      : id.includes('pro')
        ? 'pro'
        : 'flash';

  if (major >= 3) {
    if (!effort) {
      return family === 'flash-lite' ? { thinkingLevel: 'LOW' } : null;
    }
    if (effort === 'medium' && family === 'pro' && major === 3 && minor < 1) {
      return { thinkingLevel: 'HIGH' };
    }
    return { thinkingLevel: effort.toUpperCase() };
  }

  if (major === 2 && minor >= 5) {
    if (!effort) {
      return family === 'flash-lite' ? { thinkingBudget: 8192 } : null;
    }
    const budget = GEMINI_THINKING_BUDGETS[family]?.[effort];
    return Number.isFinite(budget) ? { thinkingBudget: budget } : null;
  }

  return null;
}

export function nvidiaThinkingParams(
  model: string,
  settings?: ProviderSettingsLike | null
): Record<string, unknown> {
  const id = String(model || '').toLowerCase();
  const effort = effectiveReasoningEffort(settings, 'high');

  if (id.includes('glm')) {
    return {
      chat_template_kwargs: { enable_thinking: true, clear_thinking: false },
      reasoning_effort: effort,
    };
  }

  if (id.includes('kimi-k3')) {
    const selected = rawReasoningEffort(settings);
    const kimiEffort = selected === 'low' ? 'low' : selected === 'medium' ? 'high' : 'max';
    return { reasoning_effort: kimiEffort };
  }

  if (id.includes('kimi')) {
    return { chat_template_kwargs: { thinking: true } };
  }

  if (id.includes('deepseek')) {
    if (id.includes('v4')) {
      const explicitEffort = rawReasoningEffort(settings) !== '';
      const thinkingOn = explicitEffort || !id.includes('pro');
      return {
        chat_template_kwargs: thinkingOn
          ? { thinking: true, reasoning_effort: effort }
          : { thinking: false },
      };
    }
    return { chat_template_kwargs: { thinking: true } };
  }

  if (id.includes('qwen') || id.includes('qwq')) {
    return { chat_template_kwargs: { enable_thinking: true } };
  }

  if (id.includes('nemotron')) {
    return {
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: settings?.maxTokens || 16384,
    };
  }

  if (id.includes('laguna')) {
    return { chat_template_kwargs: { enable_thinking: true } };
  }

  if (id.includes('minimax')) {
    return { chat_template_kwargs: { thinking_mode: 'enabled' } };
  }

  if (id.includes('step') || id.includes('glimmer') || id.includes('muse')) {
    return { reasoning_effort: effort };
  }

  return {};
}
