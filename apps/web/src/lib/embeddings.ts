/**
 * Vector Embedding Service - DEMO MODE
 * Generates simple hash-based embeddings (not semantic)
 * Replace with OpenAI integration when going to production
 */

/**
 * Generate mock embedding for text (DEMO MODE)
 * Creates a deterministic 1536-dimensional vector based on text hash
 * NOT semantically meaningful - for demo/testing only
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Create a simple hash-based embedding (1536 dimensions to match OpenAI)
  const embedding = new Array(1536).fill(0);
  
  // Simple hash function
  const hash = simpleHash(text.substring(0, 8000));
  
  // Distribute hash across embedding dimensions
  for (let i = 0; i < embedding.length; i++) {
    // Create pseudo-random values based on hash and position
    const seed = hash + i * 31;
    embedding[i] = (Math.sin(seed) + 1) / 2; // Normalize to 0-1
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate embedding for document text
 */
export async function generateDocumentEmbedding(text: string): Promise<number[]> {
  const truncatedText = text.substring(0, 8000);
  return generateEmbedding(truncatedText);
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
