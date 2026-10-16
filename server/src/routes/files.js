import { Router } from 'express';
import {
  getRepositoryById,
  getFilesByRepository,
  getFileByPath,
} from '../repositories/db.repository.js';

const router = Router({ mergeParams: true });

// GET /api/repositories/:id/files
router.get('/', async (req, res, next) => {
  try {
    const repo = await getRepositoryById(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const offset = parseInt(req.query.offset) || 0;

    const { files, total } = await getFilesByRepository(repo.id, { limit, offset });
    res.json({ files, total, limit, offset });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id/files/*path
router.get('/*', async (req, res, next) => {
  try {
    const repo = await getRepositoryById(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    // Extract file path from wildcard
    const filePath = req.params[0];
    if (!filePath) return res.status(400).json({ error: 'File path is required' });

    // Security: prevent path traversal
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const file = await getFileByPath(repo.id, filePath);
    if (!file) return res.status(404).json({ error: 'File not found' });

    res.json({ file });
  } catch (err) {
    next(err);
  }
});

export default router;
