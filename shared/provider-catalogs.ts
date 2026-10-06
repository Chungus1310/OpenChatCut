/**
 * Default fallback model catalogs for LLM providers.
 *
 * Adapted from llm-providers.js lines 4381-4588:
 * Provides fallback model lists per provider when live network discovery
 * is unavailable or before the first live probe has completed.
 */

export interface ModelDescriptor {
  readonly id: string;
  readonly name: string;
  readonly free?: boolean;
  readonly provider?: string;
  readonly contextWindow?: number;
  readonly reasoningEnabled?: boolean;
}

export const FALLBACK_PROVIDER_CATALOGS: Record<string, readonly ModelDescriptor[]> = {
  gemini: [
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemma-4-31b-it', name: 'Gemma 4 31B IT' },
  ],
  openai: [
    { id: 'gpt-5', name: 'GPT-5' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview' },
    { id: 'o3', name: 'o3 Reasoning' },
    { id: 'o3-mini', name: 'o3 Mini' },
    { id: 'o1', name: 'o1 Reasoning' },
  ],
  anthropic: [
    { id: 'claude-fable-5', name: 'Claude Fable 5' },
    { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
  ],
  deepseek: [
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
    { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
  ],
  qwen: [
    { id: 'qwen-plus', name: 'Qwen Plus' },
    { id: 'qwen-max', name: 'Qwen Max' },
    { id: 'qwen-turbo', name: 'Qwen Turbo' },
    { id: 'qwq-32b-preview', name: 'QwQ 32B Preview' },
  ],
  glm: [
    { id: 'glm-5.2', name: 'GLM-5.2' },
    { id: 'glm-4-plus', name: 'GLM-4 Plus' },
    { id: 'glm-4-air', name: 'GLM-4 Air' },
    { id: 'glm-4-flash', name: 'GLM-4 Flash' },
  ],
  kimi: [
    { id: 'kimi-k3', name: 'Moonshot Kimi K3' },
    { id: 'moonshot-v1-128k', name: 'Moonshot v1 128k' },
    { id: 'moonshot-v1-32k', name: 'Moonshot v1 32k' },
  ],
  minimax: [
    { id: 'MiniMax-M3', name: 'MiniMax M3' },
    { id: 'abab6.5s-chat', name: 'MiniMax abab6.5s' },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large' },
    { id: 'mistral-medium-latest', name: 'Mistral Medium' },
    { id: 'mistral-small-latest', name: 'Mistral Small' },
    { id: 'codestral-latest', name: 'Codestral' },
  ],
  openrouter: [
    { id: 'openrouter/auto', name: 'OpenRouter Auto' },
    { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B IT (Free)', free: true },
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', free: true },
    { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
  ],
};

export function getFallbackModelsForProvider(provider: string): readonly ModelDescriptor[] {
  const norm = provider.trim().toLowerCase();
  return FALLBACK_PROVIDER_CATALOGS[norm] || [];
}
