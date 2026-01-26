/**
 * Workers Bootstrap
 * Starts all BullMQ workers (Fortnox, Bank, AI) and queue listeners
 */
import pino from "pino";
import { setupQueueListeners } from "./lib/queue";
import fortnoxWorker from "./workers/etl.fortnox";
import bankWorker from "./workers/etl.bank";
import dataQualityWorker from "./workers/ai.data-quality";

const logger = pino();

// ============================================================================
// STARTUP
// ============================================================================

async function main() {
  logger.info("Starting AIFM Workers...");

  try {
    // Setup queue event listeners (logging, metrics)
    setupQueueListeners();
    logger.info("Queue listeners configured");

    // Workers are automatically processing jobs from their respective queues
    logger.info("✓ Fortnox ETL worker started");
    logger.info("✓ Bank ETL worker started");
    logger.info("✓ Data Quality AI worker started");

    logger.info("All workers running. Press Ctrl+C to stop.");

    // Graceful shutdown
    process.on("SIGINT", async () => {
      logger.info("Shutting down...");
      await fortnoxWorker.close();
      await bankWorker.close();
      await dataQualityWorker.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error }, "Failed to start workers");
    process.exit(1);
  }
}

main();
