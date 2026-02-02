import { pipeline } from '@huggingface/transformers';

let extractor = null;

async function getExtractor() {
  if (!extractor) {
    console.error('[dude] Loading embedding model (first call may download ~80 MB)…');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.error('[dude] Embedding model ready.');
  }
  return extractor;
}

/**
 * Embed a text string into a 384-dim Float32Array.
 * First call is slow (model download + ONNX init); subsequent calls are fast.
 */
export async function embed(text) {
  const ext = await getExtractor();
  const result = await ext(text, { pooling: 'mean', normalize: true });
  // result.data is a Float32Array of length 384
  return new Float32Array(result.data);
}
