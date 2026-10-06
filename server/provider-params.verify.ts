import { deepStrictEqual, strictEqual } from 'node:assert';
import {
  effectiveReasoningEffort,
  rawReasoningEffort,
  resolveGeminiThinkingConfig,
  nvidiaThinkingParams,
} from './provider-params.ts';

function runProviderParamsTests(): void {
  // 1. effectiveReasoningEffort
  strictEqual(effectiveReasoningEffort({ reasoningEffort: 'low' }), 'low');
  strictEqual(effectiveReasoningEffort({ thinkingLevel: 'xhigh' }), 'xhigh');
  strictEqual(effectiveReasoningEffort({}, 'medium'), 'medium');
  strictEqual(effectiveReasoningEffort({}, 'invalid'), 'high');

  // 2. rawReasoningEffort
  strictEqual(rawReasoningEffort({ reasoningEffort: 'low' }), 'low');
  strictEqual(rawReasoningEffort({}), '');

  // 3. resolveGeminiThinkingConfig
  deepStrictEqual(resolveGeminiThinkingConfig('gemini-3.5-flash', { reasoningEffort: 'high' }), {
    thinkingLevel: 'HIGH',
  });
  deepStrictEqual(resolveGeminiThinkingConfig('gemini-2.5-pro', { reasoningEffort: 'low' }), {
    thinkingBudget: 2048,
  });
  strictEqual(resolveGeminiThinkingConfig('text-embedding-004'), null);

  // 4. nvidiaThinkingParams
  deepStrictEqual(nvidiaThinkingParams('glm-4-plus', { reasoningEffort: 'high' }), {
    chat_template_kwargs: { enable_thinking: true, clear_thinking: false },
    reasoning_effort: 'high',
  });
  deepStrictEqual(nvidiaThinkingParams('kimi-k3', { reasoningEffort: 'low' }), {
    reasoning_effort: 'low',
  });
  deepStrictEqual(nvidiaThinkingParams('qwen-2.5-coder'), {
    chat_template_kwargs: { enable_thinking: true },
  });

  console.log('provider-params.verify: all assertions passed');
}

runProviderParamsTests();
