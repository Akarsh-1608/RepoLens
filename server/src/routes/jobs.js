import { Router } from 'express';
import { getIndexingJobById } from '../repositories/db.repository.js';

const router = Router();

// GET /api/jobs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const job = await getIndexingJobById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

export default router;
