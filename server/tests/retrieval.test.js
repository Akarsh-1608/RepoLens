import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config.js', () => ({
  config: {
    embedding: {
      apiKey: 'test-key',
      dimensions: 1536,
    },
  },
}));

vi.mock('../src/repositories/db.repository.js', () => ({
  searchChunksVector: vi.fn(),
  searchChunksKeyword: vi.fn(),
}));

vi.mock('../src/services/embedding.service.js', () => ({
  generateEmbedding: vi.fn(),
}));

import { searchRepository, retrieveContext } from '../src/services/retrieval.service.js';
import * as dbRepo from '../src/repositories/db.repository.js';
import * as embeddingService from '../src/services/embedding.service.js';

describe('searchRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retrieves and ranks chunks from the specified repository only', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    dbRepo.searchChunksVector.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'function authenticate() { return true; }',
        start_line: 10,
        end_line: 20,
        chunk_index: 0,
        path: 'src/auth.js',
        language: 'JavaScript',
        similarity: 0.88,
      },
    ]);
    dbRepo.searchChunksKeyword.mockResolvedValue([]);

    const results = await searchRepository('repo-uuid-1', 'authenticate', {
      mode: 'hybrid',
      limit: 5,
    });

    expect(dbRepo.searchChunksVector).toHaveBeenCalledWith('repo-uuid-1', [0.1, 0.2, 0.3], 5);
    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('chunk-1');
    expect(results[0].filePath).toBe('src/auth.js');
    expect(results[0].score).toBe(0.88);
  });

  it('deduplicates chunks appearing in both vector and keyword results, keeping higher score', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
    dbRepo.searchChunksVector.mockResolvedValue([
      {
        id: 'chunk-shared',
        content: 'const token = verify();',
        start_line: 5,
        end_line: 12,
        chunk_index: 1,
        path: 'src/jwt.js',
        language: 'JavaScript',
        similarity: 0.75,
      },
    ]);
    dbRepo.searchChunksKeyword.mockResolvedValue([
      {
        id: 'chunk-shared',
        content: 'const token = verify();',
        start_line: 5,
        end_line: 12,
        chunk_index: 1,
        path: 'src/jwt.js',
        language: 'JavaScript',
        rank: 0.9, // 0.9 * 0.7 = 0.63 < 0.75
      },
    ]);

    const results = await searchRepository('repo-1', 'verify token', { limit: 10 });
    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('chunk-shared');
    expect(results[0].score).toBe(0.75);
    expect(results[0].source).toBe('vector');
  });

  it('falls back to keyword search when vector search fails', async () => {
    embeddingService.generateEmbedding.mockRejectedValue(new Error('Embedding provider error'));
    dbRepo.searchChunksKeyword.mockResolvedValue([
      {
        id: 'chunk-keyword-only',
        content: 'function handleError(err) { console.error(err); }',
        start_line: 1,
        end_line: 8,
        chunk_index: 0,
        path: 'src/errors.js',
        language: 'JavaScript',
        rank: 0.8,
      },
    ]);

    const results = await searchRepository('repo-1', 'error handling', { mode: 'hybrid' });
    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('chunk-keyword-only');
    expect(results[0].source).toBe('keyword');
  });
});

describe('retrieveContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty context when no chunks match', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([0.1]);
    dbRepo.searchChunksVector.mockResolvedValue([]);
    dbRepo.searchChunksKeyword.mockResolvedValue([]);

    const result = await retrieveContext('repo-1', 'nonexistent query', {
      github_url: 'https://github.com/org/repo',
      indexed_commit_sha: 'abcdef123456',
    });

    expect(result.hasContext).toBe(false);
    expect(result.context).toBe('');
    expect(result.citations).toEqual([]);
  });

  it('generates accurate citations with GitHub line ranges', async () => {
    embeddingService.generateEmbedding.mockResolvedValue([0.1]);
    dbRepo.searchChunksVector.mockResolvedValue([
      {
        id: 'c1',
        content: 'export function login(user, pass) {\n  return auth(user, pass);\n}',
        start_line: 25,
        end_line: 27,
        chunk_index: 0,
        path: 'src/services/auth.js',
        language: 'javascript',
        similarity: 0.95,
      },
    ]);
    dbRepo.searchChunksKeyword.mockResolvedValue([]);

    const repo = {
      github_url: 'https://github.com/expressjs/express',
      indexed_commit_sha: 'a1b2c3d4e5f6',
    };

    const result = await retrieveContext('repo-1', 'login logic', repo);

    expect(result.hasContext).toBe(true);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].filePath).toBe('src/services/auth.js');
    expect(result.citations[0].startLine).toBe(25);
    expect(result.citations[0].endLine).toBe(27);
    expect(result.citations[0].githubUrl).toBe(
      'https://github.com/expressjs/express/blob/a1b2c3d4e5f6/src/services/auth.js#L25-L27'
    );
    expect(result.context).toContain('[1] File: src/services/auth.js (lines 25-27)');
  });
});
