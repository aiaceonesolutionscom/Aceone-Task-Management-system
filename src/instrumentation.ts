import { logger } from "@/lib/logger";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Catch any uncaught Node.js exceptions and log to logs/error.log
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Server Exception", { error, action: "process.uncaughtException" }, true);
    });

    // Catch any unhandled promise rejections and log to logs/error.log
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled Promise Rejection", { error: reason, action: "process.unhandledRejection" }, true);
    });

    logger.info("AceOne Server Application initialized. Real-time file logging active in logs/error.log and logs/combined.log", {
      action: "server.startup",
    });
  }
}
