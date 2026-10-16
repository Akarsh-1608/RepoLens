import crypto from 'crypto';
import {
  updateRepositoryStatus,
  upsertFile,
  updateIndexingJob,
  upsertChunk,
  updateChunkEmbedding,
  getChunksWithoutEmbeddings,
} from '../repositories/db.repository.js';
import {
  fetchRepositoryMetadata,
  fetchLatestCommitSha,
  fetchFileTree,
  shouldSkipFile,
  fetchFilesWithConcurrency,
  detectLanguage,
} from './github.service.js';
import { chunkContent } from './chunking.service.js';
import { generateEmbeddingsBatched } from './embedding.service.js';
import { config } from '../config.js';

export async function processRepository(repositoryId, jobId, { owner, name, githubUrl }) {
  console.log(`[indexing] Starting indexing for ${owner}/${name} (repo: ${repositoryId})`);
  
  try {
    // Mark job as processing
    await updateIndexingJob(jobId, { status: 'processing', startedAt: true });
    await updateRepositoryStatus(repositoryId, 'processing');

    // Step 1: Fetch metadata and commit SHA
    console.log(`[indexing] Fetching metadata for ${owner}/${name}`);
    const metadata = await fetchRepositoryMetadata(owner, name);
    const branch = metadata.defaultBranch || 'main';
    const commitSha = await fetchLatestCommitSha(owner, name, branch);

    if (!commitSha) {
      await updateRepositoryStatus(repositoryId, 'failed');
      await updateIndexingJob(jobId, {
        status: 'failed',
        errorMessage: 'Repository is empty or has no commits',
        completedAt: true,
      });
      return;
    }

    await updateRepositoryStatus(repositoryId, 'processing', {
      defaultBranch: branch,
      indexedCommitSha: commitSha,
    });

    // Step 2: Fetch file tree
    console.log(`[indexing] Fetching file tree at commit ${commitSha.substring(0, 7)}`);
    const allFiles = await fetchFileTree(owner, name, commitSha);
    
    // Step 3: Filter files
    const eligibleFiles = [];
    let totalSize = 0;

    for (const file of allFiles) {
      if (eligibleFiles.length >= config.github.maxFiles) {
        console.warn(`[indexing] File limit reached (${config.github.maxFiles}), stopping file ingestion`);
        break;
      }

      const { skip, reason } = shouldSkipFile(file.path, file.size || 0);
      if (skip) {
        continue;
      }

      totalSize += file.size || 0;
      if (totalSize > config.github.maxRepoSize) {
        console.warn(`[indexing] Total size limit reached, stopping at ${totalSize} bytes`);
        break;
      }

      eligibleFiles.push(file);
    }

    console.log(`[indexing] ${eligibleFiles.length} eligible files out of ${allFiles.length} total`);

    await updateIndexingJob(jobId, {
      totalFiles: eligibleFiles.length,
      processedFiles: 0,
      progress: 5,
    });

    // Step 4: Fetch file contents with bounded concurrency
    const filePaths = eligibleFiles.map((f) => f.path);
    console.log(`[indexing] Fetching ${filePaths.length} files...`);

    const { results: fileContents, errors } = await fetchFilesWithConcurrency(
      owner, name, filePaths, commitSha, config.github.concurrency
    );

    console.log(`[indexing] Fetched ${fileContents.size} files (${errors} errors)`);

    await updateIndexingJob(jobId, { progress: 30 });

    // Step 5: Persist files and create chunks
    let processedFiles = 0;
    const chunksToEmbed = [];

    for (const [filePath, content] of fileContents.entries()) {
      // Skip binary/null content
      if (!content || content.includes('\0')) continue;

      try {
        const contentHash = crypto.createHash('sha256').update(content).digest('hex');
        const language = detectLanguage(filePath);

        const file = await upsertFile({
          repositoryId,
          path: filePath,
          language,
          content,
          contentHash,
          sizeBytes: Buffer.byteLength(content, 'utf8'),
          indexedCommitSha: commitSha,
        });

        // Chunk the file
        const chunks = chunkContent(content, filePath, language);
        
        for (const chunk of chunks) {
          const savedChunk = await upsertChunk({
            fileId: file.id,
            repositoryId,
            chunkIndex: chunk.chunkIndex,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            content: chunk.content,
            contentHash: chunk.contentHash,
          });
          
          chunksToEmbed.push({
            chunkId: savedChunk.id,
            content: chunk.content,
            contentHash: chunk.contentHash,
          });
        }

        processedFiles++;
        const progress = 30 + Math.floor((processedFiles / fileContents.size) * 40);
        await updateIndexingJob(jobId, {
          processedFiles,
          progress,
        });
      } catch (err) {
        console.error(`[indexing] Error processing file ${filePath}:`, err.message);
      }
    }

    await updateRepositoryStatus(repositoryId, 'processing', {
      fileCount: processedFiles,
      totalSizeBytes: totalSize,
    });

    // Step 6: Generate embeddings
    if (config.embedding.apiKey && chunksToEmbed.length > 0) {
      console.log(`[indexing] Generating embeddings for ${chunksToEmbed.length} chunks...`);
      await updateIndexingJob(jobId, { progress: 70 });

      const texts = chunksToEmbed.map((c) => c.content);
      const embeddings = await generateEmbeddingsBatched(texts, 50);

      let embeddingCount = 0;
      for (let i = 0; i < chunksToEmbed.length; i++) {
        if (embeddings[i]) {
          await updateChunkEmbedding(chunksToEmbed[i].chunkId, embeddings[i]);
          embeddingCount++;
        }
      }

      console.log(`[indexing] Generated ${embeddingCount}/${chunksToEmbed.length} embeddings`);
    } else if (!config.embedding.apiKey) {
      console.warn('[indexing] No EMBEDDING_API_KEY - skipping embedding generation. Keyword search only.');
    }

    // Step 7: Mark as completed
    await updateRepositoryStatus(repositoryId, 'completed', {
      indexedCommitSha: commitSha,
      defaultBranch: branch,
      fileCount: processedFiles,
    });

    await updateIndexingJob(jobId, {
      status: 'completed',
      progress: 100,
      processedFiles,
      completedAt: true,
    });

    console.log(`[indexing] Completed indexing for ${owner}/${name}: ${processedFiles} files, ${chunksToEmbed.length} chunks`);

  } catch (err) {
    console.error(`[indexing] Fatal error for ${owner}/${name}:`, err.message);
    
    await updateRepositoryStatus(repositoryId, 'failed').catch(() => {});
    await updateIndexingJob(jobId, {
      status: 'failed',
      errorMessage: err.message,
      completedAt: true,
    }).catch(() => {});
  }
}
