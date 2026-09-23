import "reflect-metadata";
import { App } from "./app";
import { AppDataSource } from "./config/data-source";
import { env } from "./config/env";
import { errorDetails, logger } from "./config/logger";
import { startErpRetryWorker } from "./services/erpRetry.service";

AppDataSource.initialize()
  .then(() => {
    App.listen(env.port, () => {
      logger.info("Backend listening", { port: env.port });
    });
    startErpRetryWorker();
  })
  .catch((Err) => {
    logger.error("Failed to initialize data source", errorDetails(Err));
    process.exit(1);
  });
