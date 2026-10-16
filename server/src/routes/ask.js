import { Router } from 'express';
import {
  getRepositoryById,
  createChatSession,
  getChatSession,
  listChatSessions,
  addChatMessage,
  getChatMessages,
} from '../repositories/db.repository.js';
import { retrieveContext } from '../services/retrieval.service.js';
import { askLLM } from '../services/llm.service.js';
import { validate, askSchema } from '../validators/schemas.js';

const router = Router({ mergeParams: true });

// POST /api/repositories/:id/ask
router.post('/', validate(askSchema), async (req, res, next) => {
  try {
    const repo = await getRepositoryById(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    if (!['completed', 'processing'].includes(repo.status)) {
      return res.status(422).json({
        error: 'Repository has not been indexed yet. Please wait for indexing to complete.',
        status: repo.status,
      });
    }

    const { question, sessionId } = req.validated;
    const startTime = Date.now();

    // Get or create chat session
    let session;
    if (sessionId) {
      session = await getChatSession(sessionId);
      if (!session || session.repository_id !== repo.id) {
        return res.status(404).json({ error: 'Chat session not found' });
      }
    } else {
      session = await createChatSession(repo.id, question.substring(0, 100));
    }

    // Save user message
    await addChatMessage({
      sessionId: session.id,
      role: 'user',
      content: question,
    });

    // Retrieve relevant context
    const { context, citations, hasContext } = await retrieveContext(repo.id, question, repo);

    // Generate LLM answer
    const { answer, error: llmError } = await askLLM(question, context);
    const duration = Date.now() - startTime;

    // Save assistant message
    const message = await addChatMessage({
      sessionId: session.id,
      role: 'assistant',
      content: answer,
      citations,
    });

    res.json({
      sessionId: session.id,
      question,
      answer,
      citations,
      hasContext,
      latencyMs: duration,
      messageId: message.id,
      ...(llmError && { warning: llmError }),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id/sessions
router.get('/sessions', async (req, res, next) => {
  try {
    const repo = await getRepositoryById(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    const sessions = await listChatSessions(repo.id);
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// GET /api/repositories/:id/sessions/:sessionId/messages
router.get('/sessions/:sessionId/messages', async (req, res, next) => {
  try {
    const session = await getChatSession(req.params.sessionId);
    if (!session || session.repository_id !== req.params.id) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const messages = await getChatMessages(session.id);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

export default router;
