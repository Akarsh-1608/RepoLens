import 'dotenv/config';

const required = [
  'DATABASE_URL',
];

const optional = {
  PORT: '3001',
  NODE_ENV: 'development',
  CLIENT_URL: 'http://localhost:5173',
  REDIS_URL: 'redis://localhost:6379',
  USE_QUEUE_FALLBACK: 'false',
  GITHUB_TOKEN: '',
  LLM_API_KEY: '',
  LLM_MODEL: 'gpt-4o-mini',
  LLM_BASE_URL: 'https://api.openai.com/v1',
  EMBEDDING_API_KEY: '',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: '1536',
  EMBEDDING_BASE_URL: 'https://api.openai.com/v1',
  MAX_FILES_PER_REPO: '500',
  MAX_FILE_SIZE_BYTES: '102400',
  MAX_REPO_SIZE_BYTES: '52428800',
  GITHUB_CONCURRENCY: '5',
};

// Apply defaults for optional vars
for (const [key, value] of Object.entries(optional)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

// Validate required vars
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[config] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[config] Copy server/.env.example to server/.env and fill in your values.');
  process.exit(1);
}

// Warn about missing optional integrations
const integrationWarnings = [];
if (!process.env.GITHUB_TOKEN) {
  integrationWarnings.push('GITHUB_TOKEN (will use unauthenticated GitHub API - 60 req/hr limit)');
}
if (!process.env.LLM_API_KEY) {
  integrationWarnings.push('LLM_API_KEY (AI Q&A will be disabled)');
}
if (!process.env.EMBEDDING_API_KEY) {
  integrationWarnings.push('EMBEDDING_API_KEY (vector search will be disabled)');
}
if (integrationWarnings.length > 0) {
  console.warn('[config] Optional integrations not configured:');
  integrationWarnings.forEach((w) => console.warn(`  - ${w}`));
}

export const config = {
  port: parseInt(process.env.PORT, 10),
  nodeEnv: process.env.NODE_ENV,
  clientUrl: process.env.CLIENT_URL,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  useQueueFallback: process.env.USE_QUEUE_FALLBACK === 'true',
  github: {
    token: process.env.GITHUB_TOKEN || null,
    concurrency: parseInt(process.env.GITHUB_CONCURRENCY, 10),
    maxFiles: parseInt(process.env.MAX_FILES_PER_REPO, 10),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES, 10),
    maxRepoSize: parseInt(process.env.MAX_REPO_SIZE_BYTES, 10),
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || null,
    model: process.env.LLM_MODEL,
    baseUrl: process.env.LLM_BASE_URL,
  },
  embedding: {
    apiKey: process.env.EMBEDDING_API_KEY || null,
    model: process.env.EMBEDDING_MODEL,
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS, 10),
    baseUrl: process.env.EMBEDDING_BASE_URL,
  },
};
