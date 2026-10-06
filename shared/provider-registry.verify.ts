import { strictEqual } from 'node:assert';
import {
  registerProviderExtension,
  unregisterProviderExtension,
  resolveProviderDescriptor,
  getAllProviders,
} from './provider-registry.ts';
import {
  MEDIA_PROVIDER_KEY_PAIRS,
  poolKeyNameFor,
  apiKeyNameForPool,
} from './provider-keys.ts';

function runProviderRegistryTests(): void {
  // 1. Built-in preset resolution
  const anthropic = resolveProviderDescriptor('anthropic');
  strictEqual(anthropic?.id, 'anthropic');
  strictEqual(anthropic?.protocol, 'anthropic');
  strictEqual(anthropic?.isCustom, false);

  // 2. Custom extension registration
  registerProviderExtension({
    id: 'my-custom-llm',
    label: 'My Custom LLM',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.my-custom-llm.com/v1',
    defaultModel: 'custom-v1',
    description: 'Custom proxy provider',
  });

  const custom = resolveProviderDescriptor('my-custom-llm');
  strictEqual(custom?.id, 'my-custom-llm');
  strictEqual(custom?.label, 'My Custom LLM');
  strictEqual(custom?.isCustom, true);

  // 3. getAllProviders contains both
  const all = getAllProviders();
  strictEqual(all.some((p) => p.id === 'anthropic'), true);
  strictEqual(all.some((p) => p.id === 'my-custom-llm'), true);

  // 4. Unregister extension
  unregisterProviderExtension('my-custom-llm');
  strictEqual(resolveProviderDescriptor('my-custom-llm'), null);

  // 5. Universal provider key and pool bidirectional mappings
  for (const pair of MEDIA_PROVIDER_KEY_PAIRS) {
    strictEqual(poolKeyNameFor(pair.apiKey), pair.poolKey, `pool key for ${pair.apiKey}`);
    strictEqual(apiKeyNameForPool(pair.poolKey), pair.apiKey, `api key for ${pair.poolKey}`);
  }
  strictEqual(poolKeyNameFor('LLM_OPENAI_API_KEY'), 'LLM_OPENAI_KEY_POOL');
  strictEqual(apiKeyNameForPool('LLM_OPENAI_KEY_POOL'), 'LLM_OPENAI_API_KEY');

  console.log('provider-registry.verify: all assertions passed');
}

runProviderRegistryTests();
