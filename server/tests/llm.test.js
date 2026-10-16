import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.fn();

vi.mock('../src/config.js', () => ({
  config: {
    llm: {
      apiKey: 'test-llm-key',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
    },
  },
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: (...args) => mockPost(...args),
    })),
  },
}));

import { askLLM } from '../src/services/llm.service.js';

describe('askLLM', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('generates answer grounded in context', async () => {
    mockPost.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: 'Authentication is handled in `src/auth.js` on lines 10-25 using JWT tokens.',
            },
          },
        ],
      },
    });

    const context = '[1] File: src/auth.js (lines 10-25)\n```javascript\nconst jwt = require("jsonwebtoken");\n```';
    const result = await askLLM('How does auth work?', context);

    expect(result.error).toBeNull();
    expect(result.answer).toContain('Authentication is handled in `src/auth.js`');
  });

  it('handles rate limits gracefully with user-friendly message', async () => {
    const error = new Error('Rate limit');
    error.response = { status: 429 };
    mockPost.mockRejectedValue(error);

    const result = await askLLM('Explain the routing', 'some context');
    expect(result.error).toBe('rate_limit');
    expect(result.answer).toContain('temporarily rate limited');
  });

  it('handles authentication errors gracefully', async () => {
    const error = new Error('Unauthorized');
    error.response = { status: 401 };
    mockPost.mockRejectedValue(error);

    const result = await askLLM('Explain error handling', 'some context');
    expect(result.error).toBe('auth_error');
    expect(result.answer).toContain('LLM_API_KEY');
  });

  it('handles request timeouts without crashing', async () => {
    const error = new Error('Timeout');
    error.code = 'ECONNABORTED';
    mockPost.mockRejectedValue(error);

    const result = await askLLM('Analyze the whole architecture', 'huge context');
    expect(result.error).toBe('timeout');
    expect(result.answer).toContain('timed out');
  });
});
