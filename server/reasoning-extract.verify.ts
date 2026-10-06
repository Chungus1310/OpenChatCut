import { strictEqual } from 'node:assert';
import { extractReasoningText, extractResponsesReasoning } from './reasoning-extract.ts';

function runReasoningExtractTests(): void {
  // 1. extractReasoningText: single fields
  strictEqual(extractReasoningText({ reasoning_content: 'step 1' }), 'step 1');
  strictEqual(extractReasoningText({ reasoning: 'step 2' }), 'step 2');
  strictEqual(extractReasoningText({ reasoning_text: 'step 3' }), 'step 3');
  strictEqual(extractReasoningText({ thinking: 'step 4' }), 'step 4');

  // 2. extractReasoningText: precedence & deduplication
  strictEqual(extractReasoningText({ reasoning_content: 'deepseek-cot', reasoning: 'mirror-cot' }), 'deepseek-cot');
  strictEqual(extractReasoningText({ reasoning_content: '', reasoning: 'openai-cot' }), 'openai-cot');
  strictEqual(extractReasoningText({ unknown_field: 'skip' }), '');
  strictEqual(extractReasoningText(null), '');

  // 3. extractResponsesReasoning: summary arrays
  const responsesOutput = [
    { type: 'reasoning', summary: [{ text: 'thought 1' }, { text: 'thought 2' }] },
    { type: 'thinking', thinking: ' thought 3' },
  ];
  strictEqual(extractResponsesReasoning(responsesOutput), 'thought 1\nthought 2 thought 3');

  console.log('reasoning-extract.verify: all assertions passed');
}

runReasoningExtractTests();
