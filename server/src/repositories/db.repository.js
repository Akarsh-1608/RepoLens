import { query, withTransaction } from '../db/pool.js';

export async function createRepository({ owner, name, githubUrl, description, language, stars, forks }) {
  const result = await query(
    `INSERT INTO repositories (owner, name, github_url, description, language, stars, forks, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     ON CONFLICT (github_url) DO UPDATE SET
       updated_at = NOW(),
       description = EXCLUDED.description,
       language = EXCLUDED.language,
       stars = EXCLUDED.stars,
       forks = EXCLUDED.forks
     RETURNING *`,
    [owner, name, githubUrl, description || null, language || null, stars || 0, forks || 0]
  );
  return result.rows[0];
}

export async function getRepositoryById(id) {
  const result = await query('SELECT * FROM repositories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getRepositoryByUrl(githubUrl) {
  const result = await query('SELECT * FROM repositories WHERE github_url = $1', [githubUrl]);
  return result.rows[0] || null;
}

export async function listRepositories({ limit = 20, offset = 0 } = {}) {
  const result = await query(
    'SELECT * FROM repositories ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  const count = await query('SELECT COUNT(*) FROM repositories');
  return { repositories: result.rows, total: parseInt(count.rows[0].count, 10) };
}

export async function updateRepositoryStatus(id, status, extra = {}) {
  const fields = ['status = $2', 'updated_at = NOW()'];
  const values = [id, status];
  let idx = 3;

  if (extra.indexedCommitSha !== undefined) {
    fields.push(`indexed_commit_sha = $${idx++}`);
    values.push(extra.indexedCommitSha);
  }
  if (extra.defaultBranch !== undefined) {
    fields.push(`default_branch = $${idx++}`);
    values.push(extra.defaultBranch);
  }
  if (extra.fileCount !== undefined) {
    fields.push(`file_count = $${idx++}`);
    values.push(extra.fileCount);
  }
  if (extra.totalSizeBytes !== undefined) {
    fields.push(`total_size_bytes = $${idx++}`);
    values.push(extra.totalSizeBytes);
  }
  if (status === 'completed') {
    fields.push(`indexed_at = NOW()`);
  }

  const result = await query(
    `UPDATE repositories SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function upsertFile({ repositoryId, path, language, content, contentHash, sizeBytes, indexedCommitSha }) {
  const result = await query(
    `INSERT INTO repository_files (repository_id, path, language, content, content_hash, size_bytes, indexed_commit_sha)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (repository_id, path) DO UPDATE SET
       content = EXCLUDED.content,
       content_hash = EXCLUDED.content_hash,
       size_bytes = EXCLUDED.size_bytes,
       language = EXCLUDED.language,
       indexed_commit_sha = EXCLUDED.indexed_commit_sha,
       updated_at = NOW()
     RETURNING *`,
    [repositoryId, path, language || null, content, contentHash, sizeBytes, indexedCommitSha || null]
  );
  return result.rows[0];
}

export async function getFilesByRepository(repositoryId, { limit = 100, offset = 0 } = {}) {
  const result = await query(
    `SELECT id, path, language, size_bytes, content_hash, created_at
     FROM repository_files WHERE repository_id = $1
     ORDER BY path ASC LIMIT $2 OFFSET $3`,
    [repositoryId, limit, offset]
  );
  const count = await query(
    'SELECT COUNT(*) FROM repository_files WHERE repository_id = $1',
    [repositoryId]
  );
  return { files: result.rows, total: parseInt(count.rows[0].count, 10) };
}

export async function getFileByPath(repositoryId, filePath) {
  const result = await query(
    'SELECT * FROM repository_files WHERE repository_id = $1 AND path = $2',
    [repositoryId, filePath]
  );
  return result.rows[0] || null;
}

export async function getFileById(fileId) {
  const result = await query('SELECT * FROM repository_files WHERE id = $1', [fileId]);
  return result.rows[0] || null;
}

export async function getUnchangedFileIds(repositoryId, fileHashMap) {
  // Returns file IDs where content hash hasn't changed
  if (fileHashMap.size === 0) return new Set();
  
  const paths = Array.from(fileHashMap.keys());
  const result = await query(
    `SELECT id, path, content_hash FROM repository_files
     WHERE repository_id = $1 AND path = ANY($2)`,
    [repositoryId, paths]
  );
  
  const unchanged = new Set();
  for (const row of result.rows) {
    if (fileHashMap.get(row.path) === row.content_hash) {
      unchanged.add(row.id);
    }
  }
  return unchanged;
}

export async function createIndexingJob(repositoryId) {
  const result = await query(
    `INSERT INTO indexing_jobs (repository_id, status, progress)
     VALUES ($1, 'queued', 0)
     RETURNING *`,
    [repositoryId]
  );
  return result.rows[0];
}

export async function getLatestIndexingJob(repositoryId) {
  const result = await query(
    `SELECT * FROM indexing_jobs WHERE repository_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [repositoryId]
  );
  return result.rows[0] || null;
}

export async function getIndexingJobById(jobId) {
  const result = await query('SELECT * FROM indexing_jobs WHERE id = $1', [jobId]);
  return result.rows[0] || null;
}

export async function updateIndexingJob(jobId, updates) {
  const fields = [];
  const values = [jobId];
  let idx = 2;

  if (updates.status !== undefined) { fields.push(`status = $${idx++}`); values.push(updates.status); }
  if (updates.progress !== undefined) { fields.push(`progress = $${idx++}`); values.push(updates.progress); }
  if (updates.totalFiles !== undefined) { fields.push(`total_files = $${idx++}`); values.push(updates.totalFiles); }
  if (updates.processedFiles !== undefined) { fields.push(`processed_files = $${idx++}`); values.push(updates.processedFiles); }
  if (updates.errorMessage !== undefined) { fields.push(`error_message = $${idx++}`); values.push(updates.errorMessage); }
  if (updates.startedAt !== undefined) { fields.push(`started_at = NOW()`); }
  if (updates.completedAt !== undefined) { fields.push(`completed_at = NOW()`); }

  if (fields.length === 0) return;

  const result = await query(
    `UPDATE indexing_jobs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function upsertChunk({ fileId, repositoryId, chunkIndex, startLine, endLine, content, contentHash }) {
  const result = await query(
    `INSERT INTO code_chunks (file_id, repository_id, chunk_index, start_line, end_line, content, content_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (file_id, chunk_index) DO UPDATE SET
       start_line = EXCLUDED.start_line,
       end_line = EXCLUDED.end_line,
       content = EXCLUDED.content,
       content_hash = EXCLUDED.content_hash,
       embedding = NULL,
       created_at = NOW()
     RETURNING *`,
    [fileId, repositoryId, chunkIndex, startLine, endLine, content, contentHash]
  );
  return result.rows[0];
}

export async function updateChunkEmbedding(chunkId, embedding) {
  await query(
    'UPDATE code_chunks SET embedding = $2 WHERE id = $1',
    [chunkId, JSON.stringify(embedding)]
  );
}

export async function getChunksWithoutEmbeddings(repositoryId, limit = 100) {
  const result = await query(
    `SELECT cc.*, rf.path, rf.language FROM code_chunks cc
     JOIN repository_files rf ON cc.file_id = rf.id
     WHERE cc.repository_id = $1 AND cc.embedding IS NULL
     LIMIT $2`,
    [repositoryId, limit]
  );
  return result.rows;
}

export async function searchChunksVector(repositoryId, embedding, limit = 10) {
  const result = await query(
    `SELECT cc.id, cc.content, cc.start_line, cc.end_line, cc.chunk_index,
            rf.path, rf.language,
            1 - (cc.embedding <=> $2::vector) AS similarity
     FROM code_chunks cc
     JOIN repository_files rf ON cc.file_id = rf.id
     WHERE cc.repository_id = $1 AND cc.embedding IS NOT NULL
     ORDER BY cc.embedding <=> $2::vector
     LIMIT $3`,
    [repositoryId, JSON.stringify(embedding), limit]
  );
  return result.rows;
}

export async function searchChunksKeyword(repositoryId, keywords, limit = 10) {
  const tsQuery = keywords.split(/\s+/).filter(Boolean).join(' & ');
  const result = await query(
    `SELECT cc.id, cc.content, cc.start_line, cc.end_line, cc.chunk_index,
            rf.path, rf.language,
            ts_rank(to_tsvector('english', cc.content), to_tsquery('english', $2)) AS rank
     FROM code_chunks cc
     JOIN repository_files rf ON cc.file_id = rf.id
     WHERE cc.repository_id = $1
       AND to_tsvector('english', cc.content) @@ to_tsquery('english', $2)
     ORDER BY rank DESC
     LIMIT $3`,
    [repositoryId, tsQuery, limit]
  );
  return result.rows;
}

export async function createChatSession(repositoryId, title) {
  const result = await query(
    `INSERT INTO chat_sessions (repository_id, title)
     VALUES ($1, $2) RETURNING *`,
    [repositoryId, title || 'New conversation']
  );
  return result.rows[0];
}

export async function getChatSession(sessionId) {
  const result = await query('SELECT * FROM chat_sessions WHERE id = $1', [sessionId]);
  return result.rows[0] || null;
}

export async function listChatSessions(repositoryId) {
  const result = await query(
    'SELECT * FROM chat_sessions WHERE repository_id = $1 ORDER BY updated_at DESC LIMIT 50',
    [repositoryId]
  );
  return result.rows;
}

export async function addChatMessage({ sessionId, role, content, citations = [] }) {
  const result = await query(
    `INSERT INTO chat_messages (session_id, role, content, citations)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [sessionId, role, content, JSON.stringify(citations)]
  );
  await query(
    'UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1',
    [sessionId]
  );
  return result.rows[0];
}

export async function getChatMessages(sessionId) {
  const result = await query(
    'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
    [sessionId]
  );
  return result.rows;
}
