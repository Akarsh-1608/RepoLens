-- RepoLens Initial Schema Migration
-- Enables pgvector, creates tables, indexes, and constraints

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Repositories
CREATE TABLE IF NOT EXISTS repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  github_url TEXT NOT NULL UNIQUE,
  default_branch VARCHAR(255),
  indexed_commit_sha VARCHAR(64),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending','queued','processing','completed','failed')),
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  language VARCHAR(100),
  description TEXT,
  file_count INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  indexed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_repositories_owner_name ON repositories(owner, name);
CREATE INDEX IF NOT EXISTS idx_repositories_status ON repositories(status);

-- 2. Repository Files
CREATE TABLE IF NOT EXISTS repository_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  language VARCHAR(100),
  content TEXT,
  content_hash VARCHAR(64) NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  indexed_commit_sha VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(repository_id, path)
);

CREATE INDEX IF NOT EXISTS idx_files_repository_id ON repository_files(repository_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON repository_files(path);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON repository_files(content_hash);

-- 3. Code Chunks with pgvector
CREATE TABLE IF NOT EXISTS code_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES repository_files(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(file_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON code_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_chunks_repository_id ON code_chunks(repository_id);
CREATE INDEX IF NOT EXISTS idx_chunks_content_hash ON code_chunks(content_hash);

-- Full-text search index for keyword retrieval
CREATE INDEX IF NOT EXISTS idx_chunks_content_fts ON code_chunks USING gin(to_tsvector('english', content));

-- 4. Indexing Jobs
CREATE TABLE IF NOT EXISTS indexing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','completed','failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_repository_id ON indexing_jobs(repository_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON indexing_jobs(status);

-- 5. Chat Sessions & Messages
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  title VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_repository_id ON chat_sessions(repository_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat_messages(session_id);
