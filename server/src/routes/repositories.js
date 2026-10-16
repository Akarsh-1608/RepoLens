import { Router } from 'express';
import {
  createRepository,
  getRepositoryById,
  getRepositoryByUrl,
  listRepositories,
  updateRepositoryStatus,
  createIndexingJob,
  getLatestIndexingJob,
} from '../repositories/db.repository.js';
import { parseGitHubUrl, fetchRepositoryMetadata } from '../services/github.service.js';
import { enqueueIndexing } from '../jobs/queue.js';
import { validate, createRepositorySchema } from '../validators/schemas.js';

const router = Router();

// POST /api/repositories
router.post('/', validate(createRepositorySchema), async (req, res, next) => {
  try {
    const { url } = req.validated;
    const parsed = parseGitHubUrl(url);
    
    if (!parsed.valid) {
      return res.status(400).json({ error: parsed.error });
    }

    const { owner, name, normalizedUrl } = parsed;

    // Check for existing repository
    const existing = await getRepositoryByUrl(normalizedUrl);
    if (existing && ['processing', 'queued'].includes(existing.status)) {
      return res.status(202).json({
        message: 'Repository is already being indexed',
        repository: sanitizeRepo(existing),
        alreadyIndexing: true,
      });
    }

    // Fetch metadata (validates repo is accessible)
    let metadata;
    try {
      metadata = await fetchRepositoryMetadata(owner, name);
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }

    if (metadata.private) {
      return res.status(422).json({
        error: 'Private repositories are not supported. Only public repositories can be indexed.',
      });
    }

    // Upsert repository record
    const repo = await createRepository({
      owner: metadata.owner,
      name: metadata.name,
      githubUrl: normalizedUrl,
      description: metadata.description,
      language: metadata.language,
      stars: metadata.stars,
      forks: metadata.forks,
    });

    // Create indexing job
    const job = await createIndexingJob(repo.id);
    await updateRepositoryStatus(repo.id, 'queued');

    // Enqueue async indexing
    await enqueueIndexing(repo.id, job.id, {
      owner: metadata.owner,
      name: metadata.name,
      githubUrl: normalizedUrl,
    });

    return res.status(202).json({
      message: 'Repository accepted for indexing',
      repository: sanitizeRepo({ ...repo, status: 'queued' }),
      jobId: job.id,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const { repositories, total } = await listRepositories({ limit, offset });
    res.json({
      repositories: repositories.map(sanitizeRepo),
      total,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id
router.get('/:id', async (req, res, next) => {
  try {
    const repo = await getRepositoryById(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    
    const job = await getLatestIndexingJob(repo.id);
    res.json({ repository: sanitizeRepo(repo), job: job || null });
  } catch (err) {
    next(err);
  }
});

// POST /api/repositories/:id/reindex
router.post('/:id/reindex', async (req, res, next) => {
  try {
    const repo = await getRepositoryById(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    if (repo.status === 'processing') {
      return res.status(409).json({ error: 'Repository is currently being indexed' });
    }

    const job = await createIndexingJob(repo.id);
    await updateRepositoryStatus(repo.id, 'queued');

    await enqueueIndexing(repo.id, job.id, {
      owner: repo.owner,
      name: repo.name,
      githubUrl: repo.github_url,
    });

    res.status(202).json({
      message: 'Reindexing scheduled',
      jobId: job.id,
    });
  } catch (err) {
    next(err);
  }
});

function sanitizeRepo(repo) {
  return {
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    githubUrl: repo.github_url,
    description: repo.description,
    defaultBranch: repo.default_branch,
    indexedCommitSha: repo.indexed_commit_sha,
    status: repo.status,
    language: repo.language,
    stars: repo.stars,
    forks: repo.forks,
    fileCount: repo.file_count,
    totalSizeBytes: repo.total_size_bytes,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    indexedAt: repo.indexed_at,
  };
}

export default router;
