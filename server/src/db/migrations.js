import { query } from './pool.js';
import { config } from '../config.js';

const migrations = [
  {
    id: 1,
    name: 'enable_pgvector',
    sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
          CREATE EXTENSION IF NOT EXISTS vector;`,
  },
  {
    id: 2,
    name: 'create_repositories',
    sql: `CREATE TABLE IF NOT EXISTS repositories (
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
    CREATE INDEX IF NOT EXISTS idx_repositories_status ON repositories(status);`,
  },
  {
    id: 3,
    name: 'create_repository_files',
    sql: `CREATE TABLE IF NOT EXISTS repository_files (
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
    CREATE INDEX IF NOT EXISTS idx_files_content_hash ON repository_files(content_hash);`,
  },
  {
    id: 4,
    name: 'create_code_chunks',
    sql: `CREATE TABLE IF NOT EXISTS code_chunks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      file_id UUID NOT NULL REFERENCES repository_files(id) ON DELETE CASCADE,
      repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_hash VARCHAR(64) NOT NULL,
      embedding vector(${config.embedding.dimensions}),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(file_id, chunk_index)
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON code_chunks(file_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_repository_id ON code_chunks(repository_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_content_hash ON code_chunks(content_hash);`,
  },
  {
    id: 5,
    name: 'create_indexing_jobs',
    sql: `CREATE TABLE IF NOT EXISTS indexing_jobs (
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
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON indexing_jobs(status);`,
  },
  {
    id: 6,
    name: 'create_chat_sessions',
    sql: `CREATE TABLE IF NOT EXISTS chat_sessions (
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
    CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat_messages(session_id);`,
  },
  {
    id: 7,
    name: 'create_vector_index',
    sql: `CREATE INDEX IF NOT EXISTS idx_chunks_embedding 
      ON code_chunks USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);`,
  },
];

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations() {
  const result = await query('SELECT id FROM schema_migrations ORDER BY id');
  return new Set(result.rows.map((r) => r.id));
}

export async function runMigrations() {
  console.log('[migrations] Starting database migrations...');
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      console.log(`[migrations] Skipping ${migration.id}: ${migration.name} (already applied)`);
      continue;
    }

    try {
      console.log(`[migrations] Applying ${migration.id}: ${migration.name}...`);
      // Run each statement separately
      const statements = migration.sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        await query(stmt);
      }

      await query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [
        migration.id,
        migration.name,
      ]);
      console.log(`[migrations] Applied ${migration.id}: ${migration.name}`);
    } catch (err) {
      console.error(`[migrations] Failed to apply ${migration.id}: ${migration.name}:`, err.message);
      throw err;
    }
  }

  console.log('[migrations] All migrations applied successfully');
}
