/**
 * Universal provider key and pool naming contracts.
 * Connects every AI provider (LLMs, Image, Video, Voice/TTS, Music, Sound,
 * Transcription, Stock media, Sandbox, and Web scrapers) to the multi-key pool system.
 */

export interface ProviderKeyPair {
  readonly apiKey: string;
  readonly poolKey: string;
  readonly label: string;
}

export const MEDIA_PROVIDER_KEY_PAIRS: readonly ProviderKeyPair[] = [
  { apiKey: 'IMAGE_API_KEY', poolKey: 'IMAGE_KEY_POOL', label: 'OpenAI (Image)' },
  { apiKey: 'OPENAI_API_KEY', poolKey: 'OPENAI_KEY_POOL', label: 'OpenAI (General)' },
  { apiKey: 'GEMINI_API_KEY', poolKey: 'GEMINI_KEY_POOL', label: 'Google Gemini' },
  { apiKey: 'FAL_KEY', poolKey: 'FAL_KEY_POOL', label: 'Fal.ai' },
  { apiKey: 'WAVESPEED_API_KEY', poolKey: 'WAVESPEED_KEY_POOL', label: 'WaveSpeed' },
  { apiKey: 'BYTEPLUS_API_KEY', poolKey: 'BYTEPLUS_KEY_POOL', label: 'BytePlus ModelArk' },
  { apiKey: 'ELEVENLABS_API_KEY', poolKey: 'ELEVENLABS_KEY_POOL', label: 'ElevenLabs' },
  { apiKey: 'DEEPGRAM_API_KEY', poolKey: 'DEEPGRAM_KEY_POOL', label: 'Deepgram' },
  { apiKey: 'GROQ_API_KEY', poolKey: 'GROQ_KEY_POOL', label: 'Groq' },
  { apiKey: 'CARTESIA_API_KEY', poolKey: 'CARTESIA_KEY_POOL', label: 'Cartesia' },
  { apiKey: 'DOUBAO_TTS_ACCESS_KEY', poolKey: 'DOUBAO_TTS_KEY_POOL', label: '豆包 TTS' },
  { apiKey: 'INWORLD_TTS_API_KEY', poolKey: 'INWORLD_TTS_KEY_POOL', label: 'Inworld' },
  { apiKey: 'FISHAUDIO_TTS_API_KEY', poolKey: 'FISHAUDIO_TTS_KEY_POOL', label: 'Fish Audio' },
  { apiKey: 'SPEECHIFY_TTS_API_KEY', poolKey: 'SPEECHIFY_TTS_KEY_POOL', label: 'Speechify' },
  { apiKey: 'SEEDANCE_API_KEY', poolKey: 'SEEDANCE_KEY_POOL', label: 'Seedance' },
  { apiKey: 'KLING_API_KEY', poolKey: 'KLING_KEY_POOL', label: '可灵 Kling' },
  { apiKey: 'MUREKA_API_KEY', poolKey: 'MUREKA_KEY_POOL', label: 'Mureka' },
  { apiKey: 'ATLASCLOUD_API_KEY', poolKey: 'ATLASCLOUD_KEY_POOL', label: 'Atlas Cloud' },
  { apiKey: 'MINIMAX_API_KEY', poolKey: 'MINIMAX_KEY_POOL', label: 'MiniMax' },
  { apiKey: 'SONILO_API_KEY', poolKey: 'SONILO_KEY_POOL', label: 'Sonilo' },
  { apiKey: 'PEXELS_API_KEY', poolKey: 'PEXELS_KEY_POOL', label: 'Pexels' },
  { apiKey: 'PIXABAY_API_KEY', poolKey: 'PIXABAY_KEY_POOL', label: 'Pixabay' },
  { apiKey: 'UNSPLASH_ACCESS_KEY', poolKey: 'UNSPLASH_KEY_POOL', label: 'Unsplash' },
  { apiKey: 'FREESOUND_API_KEY', poolKey: 'FREESOUND_KEY_POOL', label: 'Freesound' },
  { apiKey: 'ASSEMBLYAI_API_KEY', poolKey: 'ASSEMBLYAI_KEY_POOL', label: 'AssemblyAI' },
  { apiKey: 'E2B_API_KEY', poolKey: 'E2B_KEY_POOL', label: 'E2B' },
  { apiKey: 'FIRECRAWL_API_KEY', poolKey: 'FIRECRAWL_KEY_POOL', label: 'Firecrawl' },
  { apiKey: 'UPLOAD_POST_API_KEY', poolKey: 'UPLOAD_POST_KEY_POOL', label: 'Upload-Post' },
  { apiKey: 'HIVE_API_KEY', poolKey: 'HIVE_KEY_POOL', label: 'TheHive AI' },
  { apiKey: 'MERGE_GATEWAY_API_KEY', poolKey: 'MERGE_GATEWAY_KEY_POOL', label: 'Merge AI Gateway' },
  { apiKey: 'VERCEL_IMAGE_KEY', poolKey: 'VERCEL_IMAGE_KEY_POOL', label: 'Vercel AI Gateway' },
] as const;

export const ALL_MEDIA_POOL_KEYS: readonly string[] = MEDIA_PROVIDER_KEY_PAIRS.map((p) => p.poolKey);

/**
 * Resolves the key pool variable name corresponding to an API key variable name.
 */
export function poolKeyNameFor(apiKeyName: string): string | null {
  if (apiKeyName === 'FAL_KEY') return 'FAL_KEY_POOL';
  if (apiKeyName === 'UNSPLASH_ACCESS_KEY') return 'UNSPLASH_KEY_POOL';
  if (apiKeyName === 'DOUBAO_TTS_ACCESS_KEY') return 'DOUBAO_TTS_KEY_POOL';
  if (apiKeyName === 'VERCEL_IMAGE_KEY') return 'VERCEL_IMAGE_KEY_POOL';
  if (apiKeyName.endsWith('_API_KEY')) {
    return apiKeyName.replace(/_API_KEY$/, '_KEY_POOL');
  }
  return null;
}

/**
 * Resolves the primary single API key variable name corresponding to a key pool variable name.
 */
export function apiKeyNameForPool(poolKeyName: string): string | null {
  if (poolKeyName === 'FAL_KEY_POOL') return 'FAL_KEY';
  if (poolKeyName === 'UNSPLASH_KEY_POOL') return 'UNSPLASH_ACCESS_KEY';
  if (poolKeyName === 'DOUBAO_TTS_KEY_POOL') return 'DOUBAO_TTS_ACCESS_KEY';
  if (poolKeyName === 'VERCEL_IMAGE_KEY_POOL') return 'VERCEL_IMAGE_KEY';
  if (poolKeyName.endsWith('_KEY_POOL')) {
    return poolKeyName.replace(/_KEY_POOL$/, '_API_KEY');
  }
  return null;
}
