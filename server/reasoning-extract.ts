/**
 * Unified reasoning / chain-of-thought extraction across diverse LLM wire shapes.
 *
 * Adapted from llm-providers.js lines 193-231:
 * Vendors spell the chain of thought differently on the wire: DeepSeek-style
 * `reasoning_content`, OpenAI-style `reasoning`, `reasoning_text` on routers,
 * and Merge Gateway streams it as `thinking` (choice.delta.thinking).
 *
 * Gateways also mirror the SAME text into multiple fields (e.g. Chutes sends both
 * `reasoning_content` and `reasoning`), so the first non-empty string is picked
 * to prevent duplicating thought tokens.
 */

export const REASONING_TEXT_FIELDS = [
  'reasoning_content',
  'reasoning',
  'reasoning_text',
  'thinking',
] as const;

function asArray(maybe: unknown): unknown[] {
  if (Array.isArray(maybe)) return maybe;
  if (maybe == null) return [];
  return [maybe];
}

/**
 * Extracts reasoning text from a Chat Completions chunk delta or choice object.
 * Returns the first non-empty string among recognized wire fields.
 */
export function extractReasoningText(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const obj = source as Record<string, unknown>;
  for (const field of REASONING_TEXT_FIELDS) {
    const value = obj[field];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return '';
}

/**
 * Extracts reasoning items from OpenAI-shaped /v1/responses output arrays.
 * Handles {type:'reasoning', summary:[{text}]} as well as {type:'thinking'} items.
 */
export function extractResponsesReasoning(output: unknown): string {
  let reasoning = '';
  for (const item of asArray(output)) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    if (it.type === 'reasoning' && Array.isArray(it.summary)) {
      reasoning += it.summary
        .map((s) => (s && typeof s === 'object' && typeof (s as Record<string, unknown>).text === 'string'
          ? (s as Record<string, unknown>).text
          : ''))
        .filter(Boolean)
        .join('\n');
    } else if (it.type === 'thinking' || it.type === 'reasoning_text') {
      const text = it.thinking ?? it.text ?? '';
      reasoning += String(text);
    }
  }
  return reasoning;
}
