import {
  searchChunksVector,
  searchChunksKeyword,
} from '../repositories/db.repository.js';
import { generateEmbedding } from './embedding.service.js';
import { config } from '../config.js';

const MAX_CONTEXT_CHUNKS = 8;

/**
 * Hybrid search: combines vector similarity + keyword BM25-like scoring.
 * Returns deduplicated, ranked results with citations.
 */
export async function searchRepository(repositoryId, query, { limit = 10, mode = 'hybrid' } = {}) {
  const results = [];

  // Vector search
  if (mode === 'hybrid' || mode === 'vector') {
    if (!config.embedding.apiKey) {
      console.warn('[retrieval] No embedding key - falling back to keyword search only');
    } else {
      try {
        const queryEmbedding = await generateEmbedding(query);
        const vectorResults = await searchChunksVector(repositoryId, queryEmbedding, limit);
        for (const r of vectorResults) {
          results.push({ ...r, score: r.similarity, source: 'vector' });
        }
      } catch (err) {
        console.warn('[retrieval] Vector search failed, falling back to keyword:', err.message);
      }
    }
  }

  // Keyword search
  if (mode === 'hybrid' || mode === 'keyword' || results.length === 0) {
    try {
      // Sanitize query for tsquery - remove special chars
      const cleanQuery = query.replace(/[^\w\s]/g, ' ').trim();
      if (cleanQuery.length >= 2) {
        const keywordResults = await searchChunksKeyword(repositoryId, cleanQuery, limit);
        for (const r of keywordResults) {
          results.push({ ...r, score: r.rank * 0.7, source: 'keyword' });
        }
      }
    } catch (err) {
      console.warn('[retrieval] Keyword search failed:', err.message);
    }
  }

  // Deduplicate by chunk ID, keeping highest score
  const seen = new Map();
  for (const r of results) {
    if (!seen.has(r.id) || seen.get(r.id).score < r.score) {
      seen.set(r.id, r);
    }
  }

  // Sort by score descending
  const deduplicated = Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return deduplicated.map((r) => ({
    chunkId: r.id,
    filePath: r.path,
    language: r.language,
    startLine: r.start_line,
    endLine: r.end_line,
    content: r.content,
    score: r.score,
    source: r.source,
  }));
}

/**
 * Retrieve context chunks for Q&A - returns formatted context string + citations.
 */
export async function retrieveContext(repositoryId, question, repo) {
  const chunks = await searchRepository(repositoryId, question, {
    limit: MAX_CONTEXT_CHUNKS,
    mode: 'hybrid',
  });

  if (chunks.length === 0) {
    return { context: '', citations: [], hasContext: false };
  }

  const citations = [];
  const contextParts = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const citation = {
      index: i + 1,
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      language: chunk.language,
      score: chunk.score,
      githubUrl: buildGithubUrl(repo, chunk.filePath, chunk.startLine, chunk.endLine),
      snippet: chunk.content.substring(0, 300) + (chunk.content.length > 300 ? '...' : ''),
    };
    citations.push(citation);

    contextParts.push(
      `[${i + 1}] File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})\n` +
      `\`\`\`${chunk.language || ''}\n${chunk.content}\n\`\`\``
    );
  }

  return {
    context: contextParts.join('\n\n'),
    citations,
    hasContext: true,
  };
}

function buildGithubUrl(repo, filePath, startLine, endLine) {
  if (!repo?.github_url || !repo?.indexed_commit_sha) return null;
  const base = `${repo.github_url}/blob/${repo.indexed_commit_sha}/${filePath}`;
  if (startLine && endLine) {
    return `${base}#L${startLine}-L${endLine}`;
  }
  return base;
}
