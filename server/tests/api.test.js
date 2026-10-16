import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config before importing anything that uses it
vi.mock('../src/config.js', () => ({
  config: {
    nodeEnv: 'test',
    port: 3001,
    clientUrl: 'http://localhost:5173',
    databaseUrl: 'postgresql://test',
    redisUrl: 'redis://localhost:6379',
    useQueueFallback: true,
    github: { token: null, concurrency: 5, maxFiles: 500, maxFileSize: 102400, maxRepoSize: 52428800 },
    llm: { apiKey: null, model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
    embedding: { apiKey: null, model: 'text-embedding-3-small', dimensions: 1536, baseUrl: 'https://api.openai.com/v1' },
  },
}));

// Mock db.repository
vi.mock('../src/repositories/db.repository.js', () => ({
  createRepository: vi.fn(),
  getRepositoryByUrl: vi.fn(),
  getRepositoryById: vi.fn(),
  updateRepositoryStatus: vi.fn(),
  createIndexingJob: vi.fn(),
  getLatestIndexingJob: vi.fn(),
  listRepositories: vi.fn(),
}));

// Mock github service
vi.mock('../src/services/github.service.js', () => ({
  parseGitHubUrl: vi.fn(),
  fetchRepositoryMetadata: vi.fn(),
}));

// Mock queue
vi.mock('../src/jobs/queue.js', () => ({
  initQueue: vi.fn().mockResolvedValue(undefined),
  enqueueIndexing: vi.fn().mockResolvedValue({ mode: 'in-process' }),
  closeQueue: vi.fn().mockResolvedValue(undefined),
  getQueueMode: vi.fn().mockReturnValue('in-process'),
}));

// Mock db/pool
vi.mock('../src/db/pool.js', () => ({
  testConnection: vi.fn().mockResolvedValue(true),
  query: vi.fn(),
  withTransaction: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock('../src/db/migrations.js', () => ({
  runMigrations: vi.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import app from '../src/app.js';
import * as dbRepo from '../src/repositories/db.repository.js';
import * as githubService from '../src/services/github.service.js';

describe('POST /api/repositories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts valid GitHub URL and returns 202', async () => {
    githubService.parseGitHubUrl.mockReturnValue({
      valid: true,
      owner: 'expressjs',
      name: 'express',
      normalizedUrl: 'https://github.com/expressjs/express',
    });

    githubService.fetchRepositoryMetadata.mockResolvedValue({
      owner: 'expressjs',
      name: 'express',
      description: 'Fast web framework',
      defaultBranch: 'master',
      language: 'JavaScript',
      stars: 50000,
      forks: 8000,
      private: false,
    });

    dbRepo.getRepositoryByUrl.mockResolvedValue(null);
    dbRepo.createRepository.mockResolvedValue({
      id: 'test-uuid',
      owner: 'expressjs',
      name: 'express',
      github_url: 'https://github.com/expressjs/express',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    });
    dbRepo.createIndexingJob.mockResolvedValue({ id: 'job-uuid', status: 'queued' });
    dbRepo.updateRepositoryStatus.mockResolvedValue({});

    const res = await request(app)
      .post('/api/repositories')
      .send({ url: 'https://github.com/expressjs/express' });

    expect(res.status).toBe(202);
    expect(res.body.repository).toBeDefined();
    expect(res.body.jobId).toBe('job-uuid');
  });

  it('returns 400 for invalid URL', async () => {
    githubService.parseGitHubUrl.mockReturnValue({
      valid: false,
      error: 'Invalid GitHub repository URL format',
    });

    const res = await request(app)
      .post('/api/repositories')
      .send({ url: 'https://evil.com/attack' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when url is missing', async () => {
    const res = await request(app)
      .post('/api/repositories')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 202 with alreadyIndexing for in-progress repos', async () => {
    githubService.parseGitHubUrl.mockReturnValue({
      valid: true,
      owner: 'test',
      name: 'repo',
      normalizedUrl: 'https://github.com/test/repo',
    });

    dbRepo.getRepositoryByUrl.mockResolvedValue({
      id: 'existing-id',
      status: 'processing',
      owner: 'test',
      name: 'repo',
      github_url: 'https://github.com/test/repo',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await request(app)
      .post('/api/repositories')
      .send({ url: 'https://github.com/test/repo' });

    expect(res.status).toBe(202);
    expect(res.body.alreadyIndexing).toBe(true);
  });

  it('returns 422 for private repositories', async () => {
    githubService.parseGitHubUrl.mockReturnValue({
      valid: true,
      owner: 'user',
      name: 'private-repo',
      normalizedUrl: 'https://github.com/user/private-repo',
    });

    dbRepo.getRepositoryByUrl.mockResolvedValue(null);

    githubService.fetchRepositoryMetadata.mockResolvedValue({
      owner: 'user',
      name: 'private-repo',
      private: true,
      stars: 0, forks: 0,
    });

    const res = await request(app)
      .post('/api/repositories')
      .send({ url: 'https://github.com/user/private-repo' });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('Private repositories');
  });

  it('returns 422 when repository not found on GitHub', async () => {
    githubService.parseGitHubUrl.mockReturnValue({
      valid: true,
      owner: 'ghost',
      name: 'nonexistent',
      normalizedUrl: 'https://github.com/ghost/nonexistent',
    });

    dbRepo.getRepositoryByUrl.mockResolvedValue(null);
    githubService.fetchRepositoryMetadata.mockRejectedValue(
      new Error('Repository not found or is private')
    );

    const res = await request(app)
      .post('/api/repositories')
      .send({ url: 'https://github.com/ghost/nonexistent' });

    expect(res.status).toBe(422);
  });
});

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/repositories', () => {
  it('returns repository list', async () => {
    dbRepo.listRepositories.mockResolvedValue({
      repositories: [],
      total: 0,
    });

    const res = await request(app).get('/api/repositories');
    expect(res.status).toBe(200);
    expect(res.body.repositories).toBeDefined();
    expect(Array.isArray(res.body.repositories)).toBe(true);
  });
});

describe('GET /api/repositories/:id', () => {
  it('returns 404 for missing repo', async () => {
    dbRepo.getRepositoryById.mockResolvedValue(null);
    const res = await request(app).get('/api/repositories/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('returns repository with job', async () => {
    dbRepo.getRepositoryById.mockResolvedValue({
      id: 'test-id',
      owner: 'test',
      name: 'repo',
      github_url: 'https://github.com/test/repo',
      status: 'completed',
      created_at: new Date(),
      updated_at: new Date(),
    });
    dbRepo.getLatestIndexingJob.mockResolvedValue({
      id: 'job-id',
      status: 'completed',
      progress: 100,
    });

    const res = await request(app).get('/api/repositories/test-id');
    expect(res.status).toBe(200);
    expect(res.body.repository).toBeDefined();
    expect(res.body.job).toBeDefined();
  });
});
