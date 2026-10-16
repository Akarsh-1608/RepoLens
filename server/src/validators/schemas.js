import { z } from 'zod';
import { parseGitHubUrl } from '../services/github.service.js';

export const createRepositorySchema = z.object({
  url: z
    .string({ required_error: 'url is required' })
    .min(1, 'url must not be empty')
    .max(500, 'url is too long')
    .transform((url) => url.trim())
    .refine(
      (url) => {
        const result = parseGitHubUrl(url);
        return result.valid;
      },
      {
        message: 'Invalid GitHub repository URL. Expected format: https://github.com/owner/repo',
      }
    ),
});

export const searchSchema = z.object({
  query: z
    .string({ required_error: 'query is required' })
    .min(2, 'query must be at least 2 characters')
    .max(500, 'query is too long')
    .transform((q) => q.trim()),
  mode: z.enum(['hybrid', 'vector', 'keyword']).optional().default('hybrid'),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const askSchema = z.object({
  question: z
    .string({ required_error: 'question is required' })
    .min(5, 'question must be at least 5 characters')
    .max(1000, 'question is too long')
    .transform((q) => q.trim()),
  sessionId: z.string().uuid().optional(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export function validate(schema) {
  return (req, res, next) => {
    const source = req.method === 'GET' ? req.query : req.body;
    const result = schema.safeParse(source);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    // Attach parsed data
    req.validated = result.data;
    next();
  };
}
