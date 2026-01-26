/**
 * BullMQ Queue Setup
 * Manages job queues with Redis backend for ETL, AI, reports, compliance
 */
import { Queue, Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import pino from "pino";
import { ETLJobPayload, AIJobPayload } from "@aifm/shared";

const logger = pino();

// ============================================================================
// REDIS CONNECTION
// ============================================================================

export const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

redisConnection.on("connect", () => {
  logger.info("Redis connected");
});

// ============================================================================
// QUEUE DEFINITIONS
// ============================================================================

export const etlQueue = new Queue("etl", { connection: redisConnection });
export const aiQueue = new Queue("ai", { connection: redisConnection });
export const reportsQueue = new Queue("reports", { connection: redisConnection });
export const complianceQueue = new Queue("compliance", { connection: redisConnection });
export const onboardingQueue = new Queue("onboarding", { connection: redisConnection });

// ============================================================================
// JOB ENQUEUING HELPERS
// ============================================================================

export async function enqueueETLJob(payload: ETLJobPayload) {
  const jobKey = `${payload.clientId}:${payload.source}:${new Date().toISOString().split("T")[0]}`;
  return etlQueue.add("sync", payload, {
    jobId: jobKey,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
  });
}

export async function enqueueAIJob(payload: AIJobPayload) {
  const jobKey = `${payload.clientId}:${payload.task}:${payload.period.start}`;
  return aiQueue.add(payload.task, payload, {
    jobId: jobKey,
    priority: payload.task === "report_draft" ? 2 : 1,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  });
}

// ============================================================================
// QUEUE EVENT HANDLERS
// ============================================================================

export function setupQueueListeners() {
  etlQueue.on("completed" as any, (job: any) => {
    logger.info({ jobId: job.id, clientId: job.data.clientId }, "ETL job completed");
  });

  etlQueue.on("failed" as any, (job: any, err: any) => {
    logger.error(
      { jobId: job?.id, error: err.message, stack: err.stack },
      "ETL job failed"
    );
  });

  aiQueue.on("completed" as any, (job: any) => {
    logger.info({ jobId: job.id, task: job.data.task }, "AI job completed");
  });

  aiQueue.on("failed" as any, (job: any, err: any) => {
    logger.error(
      { jobId: job?.id, error: err.message, stack: err.stack },
      "AI job failed"
    );
  });

  reportsQueue.on("completed" as any, (job: any) => {
    logger.info({ jobId: job.id }, "Report job completed");
  });

  reportsQueue.on("failed" as any, (job: any, err: any) => {
    logger.error(
      { jobId: job?.id, error: err.message },
      "Report job failed"
    );
  });
}

// ============================================================================
// QUEUE HEALTH CHECK
// ============================================================================

export async function getQueueHealth() {
  try {
    const etlCounts = await (etlQueue as any).getCountsData?.() ?? (etlQueue as any).getJobCounts?.();
    const aiCounts = await (aiQueue as any).getCountsData?.() ?? (aiQueue as any).getJobCounts?.();
    const reportsCounts = await (reportsQueue as any).getCountsData?.() ?? (reportsQueue as any).getJobCounts?.();
    const complianceCounts = await (complianceQueue as any).getCountsData?.() ?? (complianceQueue as any).getJobCounts?.();

    return {
      healthy: true,
      queues: {
        etl: etlCounts,
        ai: aiCounts,
        reports: reportsCounts,
        compliance: complianceCounts,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error({ error }, "Failed to get queue health");
    return {
      healthy: false,
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    };
  }
}
