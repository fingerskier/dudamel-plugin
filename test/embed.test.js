import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock @huggingface/transformers before importing embed
const mockExtractor = vi.fn(async (text, opts) => {
  // Return a mock result with a 384-dim Float32Array
  const data = new Float32Array(384);
  for (let i = 0; i < 384; i++) {
    let hash = 0;
    for (let j = 0; j < text.length; j++) {
      hash = ((hash << 5) - hash + text.charCodeAt(j)) | 0;
    }
    data[i] = Math.sin(hash + i);
  }
  return { data };
});

const mockPipeline = vi.fn(async () => mockExtractor);

vi.mock('@huggingface/transformers', () => ({
  pipeline: mockPipeline,
}));

describe('embed.js', () => {
  let embed;

  beforeAll(async () => {
    const mod = await import('../src/embed.js');
    embed = mod.embed;
  });

  it('should export an embed function', () => {
    expect(typeof embed).toBe('function');
  });

  it('should return a Float32Array of length 384', async () => {
    const result = await embed('hello world');
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(384);
  });

  it('should produce consistent results for the same input', async () => {
    const r1 = await embed('test input');
    const r2 = await embed('test input');
    expect(Array.from(r1)).toEqual(Array.from(r2));
  });

  it('should initialize the pipeline with correct parameters', () => {
    expect(mockPipeline).toHaveBeenCalledWith('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  });

  it('should call extractor with pooling and normalize options', async () => {
    await embed('check options');
    expect(mockExtractor).toHaveBeenCalledWith('check options', { pooling: 'mean', normalize: true });
  });

  it('should handle empty string input', async () => {
    const result = await embed('');
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(384);
  });

  it('should handle long text input', async () => {
    const longText = 'word '.repeat(10000);
    const result = await embed(longText);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(384);
  });

  it('should cache the extractor (lazy singleton) — pipeline called only once', () => {
    // pipeline should only have been called once across all tests
    // because getExtractor() caches the result
    expect(mockPipeline).toHaveBeenCalledTimes(1);
  });
});
