import {
  LLM_PROVIDER_PRESETS,
  type LlmProtocol,
} from './llm-providers.ts';

export interface ProviderExtensionDescriptor {
  readonly id: string;
  readonly label: string;
  readonly protocol: LlmProtocol;
  readonly baseUrl: string;
  readonly defaultModel: string;
  readonly isCustom?: boolean;
  readonly description?: string;
}

const customRegistry = new Map<string, ProviderExtensionDescriptor>();

/**
 * Register or override an LLM provider extension.
 */
export function registerProviderExtension(desc: ProviderExtensionDescriptor): void {
  const normalizedId = desc.id.trim().toLowerCase();
  customRegistry.set(normalizedId, {
    ...desc,
    id: normalizedId,
    isCustom: true,
  });
}

/**
 * Unregister a custom provider extension.
 */
export function unregisterProviderExtension(id: string): boolean {
  return customRegistry.delete(id.trim().toLowerCase());
}

/**
 * Resolve provider descriptor (built-in preset or custom extension).
 */
export function resolveProviderDescriptor(id: unknown): ProviderExtensionDescriptor | null {
  if (typeof id !== 'string') return null;
  const normalized = id.trim().toLowerCase();

  // Check custom extensions first (allows overriding or extension)
  if (customRegistry.has(normalized)) {
    return customRegistry.get(normalized)!;
  }

  // Check built-in presets
  const preset = LLM_PROVIDER_PRESETS.find((p) => p.id === normalized);
  if (preset) {
    return {
      id: preset.id,
      label: preset.label,
      protocol: preset.protocol,
      baseUrl: preset.baseUrl,
      defaultModel: preset.defaultModel,
      isCustom: false,
    };
  }

  return null;
}

/**
 * Returns all available provider descriptors (built-in presets + custom extensions).
 */
export function getAllProviders(): ProviderExtensionDescriptor[] {
  const presets: ProviderExtensionDescriptor[] = LLM_PROVIDER_PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    protocol: p.protocol,
    baseUrl: p.baseUrl,
    defaultModel: p.defaultModel,
    isCustom: false,
  }));

  for (const custom of customRegistry.values()) {
    const existingIndex = presets.findIndex((p) => p.id === custom.id);
    if (existingIndex >= 0) {
      presets[existingIndex] = custom;
    } else {
      presets.push(custom);
    }
  }

  return presets;
}
