import axios from 'axios';
import { config } from '../config.js';

let client = null;

function getClient() {
  if (!client) {
    client = axios.create({
      baseURL: config.embedding.baseUrl,
      headers: {
        Authorization: `Bearer ${config.embedding.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }
  return client;
}

/**
 * Generate embeddings for a batch of texts.
 * Returns array of float arrays in same order as input.
 */
export async function generateEmbeddings(texts) {
  if (!config.embedding.apiKey) {
    throw new Error('EMBEDDING_API_KEY is not configured. Vector search is unavailable.');
  }

  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  // Sanitize inputs - truncate very long texts
  const sanitized = texts.map((t) =>
    typeof t === 'string' ? t.substring(0, 8000) : String(t).substring(0, 8000)
  );

  try {
    const response = await getClient().post('/embeddings', {
      model: config.embedding.model,
      input: sanitized,
    });

    const embeddings = response.data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);

    // Validate dimensions
    if (embeddings.length > 0 && embeddings[0].length !== config.embedding.dimensions) {
      console.warn(
        `[embedding] Dimension mismatch: expected ${config.embedding.dimensions}, got ${embeddings[0].length}. ` +
        'Update EMBEDDING_DIMENSIONS in .env.'
      );
    }

    return embeddings;
  } catch (err) {
    if (err.response?.status === 429) {
      throw new Error('Embedding provider rate limit exceeded. Please retry.');
    }
    if (err.response?.status === 401) {
      throw new Error('Invalid EMBEDDING_API_KEY.');
    }
    throw new Error(`Embedding generation failed: ${err.response?.data?.error?.message || err.message}`);
  }
}

export async function generateEmbedding(text) {
  const results = await generateEmbeddings([text]);
  return results[0];
}

/**
 * Generate embeddings in batches to avoid API limits.
 */
export async function generateEmbeddingsBatched(texts, batchSize = 100) {
  const allEmbeddings = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const embeddings = await generateEmbeddings(batch);
      allEmbeddings.push(...embeddings);
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < texts.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    } catch (err) {
      console.error(`[embedding] Batch ${i}-${i + batchSize} failed:`, err.message);
      // Push null placeholders for failed batch
      for (let j = 0; j < batch.length; j++) {
        allEmbeddings.push(null);
      }
    }
  }

  return allEmbeddings;
}
