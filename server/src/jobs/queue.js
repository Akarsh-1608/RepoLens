/**
 * Queue abstraction supporting both BullMQ (Redis) and in-process fallback.
 * 
 * When Redis is available: jobs are processed by a persistent BullMQ worker.
 * Fallback mode: jobs run in-process immediately after HTTP response is sent.
 * 
 * WARNING: In-process fallback is NOT production-safe. Jobs will be lost on 
 * server restart and concurrent processing is limited. Use Redis in production.
 */

import { config } from '../config.js';
import { processRepository } from '../services/indexing.service.js';

let queue = null;
let worker = null;
let isUsingFallback = false;

const QUEUE_NAME = 'indexing';

export async function initQueue() {
  if (config.useQueueFallback) {
    console.warn('[queue] USE_QUEUE_FALLBACK=true. Using in-process queue. NOT suitable for production.');
    isUsingFallback = true;
    return;
  }

  try {
    const { Queue, Worker } = await import('bullmq');
    const { default: IORedis } = await import('ioredis');

    const connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    await connection.connect();
    console.log('[queue] Connected to Redis');

    queue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        const { repositoryId, jobId, owner, name, githubUrl } = job.data;
        await processRepository(repositoryId, jobId, { owner, name, githubUrl });
      },
      {
        connection,
        concurrency: 2,
      }
    );

    worker.on('failed', (job, err) => {
      console.error(`[queue] Job ${job?.id} failed:`, err.message);
    });

    worker.on('completed', (job) => {
      console.log(`[queue] Job ${job.id} completed`);
    });

    console.log('[queue] BullMQ worker started');
  } catch (err) {
    console.warn('[queue] Redis unavailable, falling back to in-process queue:', err.message);
    console.warn('[queue] Set USE_QUEUE_FALLBACK=true in .env to suppress this warning.');
    isUsingFallback = true;
  }
}

export async function enqueueIndexing(repositoryId, jobId, { owner, name, githubUrl }) {
  const jobData = { repositoryId, jobId, owner, name, githubUrl };

  if (isUsingFallback || !queue) {
    // Run after current event loop tick so HTTP response is sent first
    console.log(`[queue] Scheduling in-process indexing for ${owner}/${name}`);
    setImmediate(() => {
      processRepository(repositoryId, jobId, { owner, name, githubUrl }).catch((err) => {
        console.error('[queue] In-process indexing error:', err.message);
      });
    });
    return { mode: 'in-process' };
  }

  const job = await queue.add('index-repo', jobData, {
    jobId: jobId, // Idempotency: reuse job ID
    priority: 1,
  });

  return { mode: 'bullmq', bullJobId: job.id };
}

export async function closeQueue() {
  try {
    if (worker) await worker.close();
    if (queue) await queue.close();
  } catch (err) {
    console.error('[queue] Error closing queue:', err.message);
  }
}

export function getQueueMode() {
  return isUsingFallback ? 'in-process' : 'bullmq';
}
