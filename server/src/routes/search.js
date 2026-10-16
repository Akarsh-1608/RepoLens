import { Router } from 'express';
import { getRepositoryById } from '../repositories/db.repository.js';
import { searchRepository } from '../services/retrieval.service.js';
import { validate, searchSchema } from '../validators/schemas.js';

const router = Router({ mergeParams: true });

// POST /api/repositories/:id/search
router.post('/', validate(searchSchema), async (req, res, next) => {
  try {
    const repo = await getRepositoryById(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    if (!['completed', 'processing'].includes(repo.status)) {
      return res.status(422).json({
        error: 'Repository has not been indexed yet',
        status: repo.status,
      });
    }

    const { query, mode, limit } = req.validated;
    const startTime = Date.now();

    const results = await searchRepository(repo.id, query, { limit, mode });
    const duration = Date.now() - startTime;

    res.json({
      query,
      mode,
      results: results.map((r) => ({
        chunkId: r.chunkId,
        filePath: r.filePath,
        language: r.language,
        startLine: r.startLine,
        endLine: r.endLine,
        content: r.content,
        score: r.score,
        source: r.source,
        githubUrl: buildGithubUrl(repo, r.filePath, r.startLine, r.endLine),
      })),
      total: results.length,
      latencyMs: duration,
    });
  } catch (err) {
    next(err);
  }
});

function buildGithubUrl(repo, filePath, startLine, endLine) {
  if (!repo.github_url || !repo.indexed_commit_sha) return null;
  const base = `${repo.github_url}/blob/${repo.indexed_commit_sha}/${filePath}`;
  return startLine ? `${base}#L${startLine}-L${endLine}` : base;
}

export default router;
