export const DEMO_EMBEDDING_DIMENSIONS = 1536;
export const DEMO_EMBEDDING_MODEL = 'demo-hash-embedding-v1';

export function buildDemoEmbedding(seedText: string): number[] {
  // This deterministic vector is only for local fallback data; real RAG uses the configured embedding model.
  let hash = 2166136261;

  for (const char of seedText) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Array.from({ length: DEMO_EMBEDDING_DIMENSIONS }, (_, index) => {
    hash ^= index + 1;
    hash = Math.imul(hash, 16777619);

    const normalized = (hash >>> 0) / 4294967295;
    return Number((normalized * 2 - 1).toFixed(6));
  });
}

export function toPgVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}
