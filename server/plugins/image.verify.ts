import assert from 'node:assert/strict';
import { validateImageRequest } from './image.ts';
import {
  callGrokImageProvider,
  callHiveProvider,
  callMergeGatewayProvider,
  callVercelImageProvider,
} from './image-provider-clients.ts';

const basic = validateImageRequest({ prompt: 'a cat' });
assert.equal(basic.model, 'gpt-image-2');
assert.equal(basic.aspectRatio, '16:9');
assert.equal(basic.count, 1);

const mm = validateImageRequest({
  model: 'image-01',
  prompt: 'matte bottle',
  count: 3,
  seed: 42,
  width: 1024,
  height: 1536,
  referencePaths: ['/media/uploads/a.jpg'],
  promptOptimizer: false,
});
assert.equal(mm.model, 'image-01');
assert.equal(mm.promptOptimizer, false);
assert.equal(mm.count, 3);
assert.equal(mm.seed, 42);
assert.equal(mm.width, 1024);
assert.equal(mm.referencePaths.length, 1);

assert.throws(
  () => validateImageRequest({ model: 'image-01', prompt: 'x'.repeat(1501) }),
  /at most 1500 characters/,
);
assert.throws(
  () => validateImageRequest({ model: 'image-01', prompt: 'x', count: 10 }),
  /at most 9 images/,
);
assert.throws(
  () => validateImageRequest({ model: 'image-01', prompt: 'x', width: 1025, height: 1024 }),
  /divisible by 8/,
);
assert.throws(
  () => validateImageRequest({ model: 'gpt-image-2', prompt: 'x', promptOptimizer: true }),
  /promptOptimizer is supported by image-01/,
);
assert.throws(
  () => validateImageRequest({ model: 'nano-banana', prompt: 'x', referencePaths: Array.from({ length: 15 }, (_, i) => `/media/uploads/${i}.jpg`) }),
  /too many reference images/,
);

const gpt = validateImageRequest({
  model: 'gpt-image-2',
  prompt: 'product shot',
  referencePaths: ['/media/uploads/source.png'],
  maskPath: '/media/uploads/mask.png',
  background: 'transparent',
  moderation: 'low',
  inputFidelity: 'high',
  outputFormat: 'webp',
  outputCompression: 82,
});
assert.equal(gpt.inputFidelity, 'high');
assert.equal(gpt.outputCompression, 82);
assert.throws(
  () => validateImageRequest({ model: 'gpt-image-2', prompt: 'x', outputCompression: 80 }),
  /requires outputFormat jpeg or webp/,
);
assert.throws(
  () => validateImageRequest({ model: 'nano-banana', prompt: 'x', quality: 'high' }),
  /GPT Image options are not supported/,
);

const waveSpeed = validateImageRequest({ model: 'wavespeed', prompt: 'a mountain at sunset', aspectRatio: '1:1' });
assert.equal(waveSpeed.model, 'wavespeed');
assert.equal(waveSpeed.aspectRatio, '1:1');
assert.throws(
  () => validateImageRequest({ model: 'wavespeed', prompt: 'x', quality: 'high' }),
  /GPT Image options are not supported/,
);
assert.throws(
  () => validateImageRequest({ model: 'wavespeed', prompt: 'x', referencePaths: ['/media/uploads/a.jpg'] }),
  /too many reference images/,
);

const byteplus = validateImageRequest({ model: 'byteplus', prompt: 'a neon city street', aspectRatio: '9:16' });
assert.equal(byteplus.model, 'byteplus');
assert.equal(byteplus.aspectRatio, '9:16');
assert.throws(
  () => validateImageRequest({ model: 'byteplus', prompt: 'x', referencePaths: ['/media/uploads/a.jpg'] }),
  /too many reference images/,
);


const grok = validateImageRequest({ model: 'grok-imagine', prompt: 'a corgi surfing', aspectRatio: '9:16', imageSize: '2K', count: 4 });
assert.equal(grok.model, 'grok-imagine');
assert.equal(grok.aspectRatio, '9:16');
assert.equal(grok.count, 4);
assert.throws(
  () => validateImageRequest({ model: 'grok-imagine', prompt: 'x', imageSize: '4K' }),
  /imageSize must be 1K or 2K/,
);
assert.throws(
  () => validateImageRequest({ model: 'grok-imagine', prompt: 'x', aspectRatio: '21:9' }),
  /does not support aspect ratio/,
);
assert.throws(
  () => validateImageRequest({ model: 'grok-imagine', prompt: 'x', count: 5 }),
  /at most 4 images/,
);
assert.throws(
  () => validateImageRequest({ model: 'grok-imagine', prompt: 'x', referencePaths: ['/media/uploads/a.jpg'] }),
  /too many reference images/,
);
assert.throws(
  () => validateImageRequest({ model: 'grok-imagine', prompt: 'x', width: 1024, height: 1024 }),
  /custom width\/height are not supported/,
);

const hiveReq = validateImageRequest({ model: 'thehiveai', prompt: 'stone wall', width: 1024, height: 1024 });
assert.equal(hiveReq.model, 'thehiveai');
assert.equal(hiveReq.width, 1024);
assert.equal(hiveReq.height, 1024);

const mergeReq = validateImageRequest({ model: 'merge', prompt: 'golden clock', quality: 'high', width: 1024, height: 1024 });
assert.equal(mergeReq.model, 'merge');
assert.equal(mergeReq.quality, 'high');

const vercelReq = validateImageRequest({ model: 'vercel', prompt: 'futuristic city', imageSize: '1K' });
assert.equal(vercelReq.model, 'vercel');

const originalFetch = globalThis.fetch;
let grokRequest: Record<string, unknown> | null = null;
let hiveRequest: Record<string, unknown> | null = null;
let mergeRequest: Record<string, unknown> | null = null;
let vercelRequest: Record<string, unknown> | null = null;

globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(_input);
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  if (url.includes('thehive.ai')) {
    hiveRequest = body;
    return new Response(JSON.stringify({ output: [{ url: 'https://example.com/hive.png' }] }), {
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.includes('api-gateway.merge.dev')) {
    mergeRequest = body;
    return new Response(JSON.stringify({ data: [{ b64_json: 'aGVsbG8=' }] }), {
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url.includes('ai-gateway.vercel.sh')) {
    vercelRequest = body;
    return new Response(JSON.stringify({ data: [{ url: 'https://example.com/vercel.png' }] }), {
      headers: { 'content-type': 'application/json' },
    });
  }
  grokRequest = body;
  return new Response(JSON.stringify({ data: [{ b64_json: 'aGVsbG8=' }] }), {
    headers: { 'content-type': 'application/json' },
  });
}) as typeof fetch;

await callGrokImageProvider('https://api.x.ai/v1', 'test-key', 'grok-imagine-image', {
  prompt: 'portrait', count: 1, aspectRatio: '9:16', imageSize: '2K',
});

const hiveImages = await callHiveProvider('https://api.thehive.ai/api/v3/hive/flux-schnell-enhanced', 'test-hive-key', 'flux-schnell-enhanced', {
  prompt: 'textured stone', count: 1, width: 1024, height: 1024,
});
assert.equal(hiveImages.length, 1);
assert.equal((hiveRequest as any)?.input?.prompt, 'textured stone');
assert.equal((hiveRequest as any)?.input?.image_size?.width, 1024);

const mergeImages = await callMergeGatewayProvider('https://api-gateway.merge.dev/v1/images/generations', 'test-merge-key', 'openai/gpt-image-2.5-sunburst', {
  prompt: 'golden clock', count: 1, width: 1024, height: 1024, quality: 'medium',
});
assert.equal(mergeImages.length, 1);
assert.equal((mergeRequest as any)?.model, 'openai/gpt-image-2.5-sunburst');
assert.equal((mergeRequest as any)?.quality, 'medium');

const vercelImages = await callVercelImageProvider('https://ai-gateway.vercel.sh/v1/images/generations', 'test-vercel-key', 'bytedance/seedream-5.0-pro', {
  prompt: 'city view', count: 1, width: 1344, height: 768,
});
assert.equal(vercelImages.length, 1);
assert.equal((vercelRequest as any)?.model, 'bytedance/seedream-5.0-pro');

globalThis.fetch = originalFetch;
assert.equal((grokRequest as any)?.aspect_ratio, '9:16', 'Grok receives the requested aspect ratio');
console.log('image.check: ok (provider-specific official parameters)');
