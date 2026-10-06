import { strictEqual, deepStrictEqual } from 'node:assert';
import {
  normalizeKeyPool,
  setConfiguredKeyPool,
  getNextKey,
  markKeySuccess,
  markKeyFailure,
  shouldFailover,
  resetKeyPool,
  getKeyPoolSummary,
  closeUnbalancedReasoningTag,
  withStreamingOutputGuard,
  stopFailoverAfterStreamingOutput,
  STREAM_OUTPUT_GUARD,
} from './key-pool.ts';

function runKeyPoolTests(): void {
  // 1. Normalization tests
  deepStrictEqual(normalizeKeyPool(''), []);
  deepStrictEqual(normalizeKeyPool('   '), []);
  deepStrictEqual(normalizeKeyPool('sk-single'), ['sk-single']);
  deepStrictEqual(normalizeKeyPool('sk-1, sk-2 , sk-3'), ['sk-1', 'sk-2', 'sk-3']);
  deepStrictEqual(normalizeKeyPool('sk-1\nsk-2\r\nsk-3'), ['sk-1', 'sk-2', 'sk-3']);
  deepStrictEqual(normalizeKeyPool('["sk-a", "sk-b", "sk-a"]'), ['sk-a', 'sk-b']);
  deepStrictEqual(normalizeKeyPool(['sk-1', 'sk-2', 'sk-1', ' ']), ['sk-1', 'sk-2']);

  // 2. Sticky Key Selection & Attempts
  resetKeyPool('anthropic');
  setConfiguredKeyPool('anthropic', ['key-1', 'key-2', 'key-3']);

  let current = getNextKey('anthropic');
  strictEqual(current.currentIndex, 0);
  strictEqual(current.currentKey, 'key-1');

  // Success keeps key sticky
  markKeySuccess('anthropic', 0);
  current = getNextKey('anthropic');
  strictEqual(current.currentIndex, 0);
  strictEqual(current.currentKey, 'key-1');
  strictEqual(current.status[0], 'working');

  // First failure: retries the same key (KEY_ATTEMPTS_PER_KEY = 2)
  const advanced1 = markKeyFailure('anthropic', 0, new Error('Rate limit exceeded 429'));
  strictEqual(advanced1, false);
  strictEqual(current.status[0], 'rate-limited');
  current = getNextKey('anthropic');
  strictEqual(current.currentIndex, 0); // Still key-1

  // Second failure: advances to key-2
  const advanced2 = markKeyFailure('anthropic', 0, new Error('Rate limit exceeded 429'));
  strictEqual(advanced2, true);
  current = getNextKey('anthropic');
  strictEqual(current.currentIndex, 1);
  strictEqual(current.currentKey, 'key-2');

  // Summary check
  const summary = getKeyPoolSummary('anthropic');
  strictEqual(summary.totalKeys, 3);
  strictEqual(summary.rateLimitedCount, 1);
  strictEqual(summary.currentIndex, 1);

  // 3. AbortError guard
  const abortErr = new Error('The operation was aborted');
  abortErr.name = 'AbortError';
  strictEqual(shouldFailover(abortErr), false);

  const regularErr = new Error('500 Internal Server Error');
  strictEqual(shouldFailover(regularErr), true);

  // 4. Close unbalanced reasoning tag
  strictEqual(closeUnbalancedReasoningTag('Hello world'), 'Hello world');
  strictEqual(closeUnbalancedReasoningTag('<think>Thinking here</think> Answer'), '<think>Thinking here</think> Answer');
  const fixed = closeUnbalancedReasoningTag('<think>Unfinished thoughts');
  strictEqual(fixed.includes('</think>'), true);

  const fixedThinking = closeUnbalancedReasoningTag('<thinking>Unfinished thoughts');
  strictEqual(fixedThinking.includes('</thinking>'), true);

  // 5. Streaming output guard
  let tokens = '';
  const settings = withStreamingOutputGuard({
    stream: true,
    onToken: (tok: string) => { tokens += tok; },
  });

  strictEqual(settings[STREAM_OUTPUT_GUARD]?.outputStarted, false);
  // Before output started -> returns null (allows failover)
  strictEqual(stopFailoverAfterStreamingOutput('anthropic', settings, new Error('network drop')), null);

  // Output starts
  settings.onToken?.('Hello ');
  strictEqual(settings[STREAM_OUTPUT_GUARD]?.outputStarted, true);
  // After output started -> returns partial and stops failover
  const partial = stopFailoverAfterStreamingOutput('anthropic', settings, new Error('network drop'));
  strictEqual(partial, 'Hello ');

  console.log('key-pool.verify: all assertions passed');
}

runKeyPoolTests();
