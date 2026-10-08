import fs from "fs";
import path from "path";
import { recordAudit } from "@/lib/audit";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogContext {
  userId?: number | null;
  module?: string;
  action?: string;
  entityId?: string | number;
  ip?: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

class SystemLogger {
  private logDir: string;

  constructor() {
    this.logDir = path.join(process.cwd(), "logs");
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch {
      // Ignore if filesystem is restricted or read-only
    }
  }

  private getLogFilename(prefix: "combined" | "error" = "combined"): string {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return path.join(this.logDir, `${prefix}-${today}.log`);
  }

  private writeToFile(filepath: string, line: string) {
    try {
      fs.appendFileSync(filepath, line + "\n", "utf8");
    } catch (err) {
      // In serverless / restricted edge environments, silently fall back
    }
  }

  private formatError(err: unknown): { message: string; stack?: string } {
    if (err instanceof Error) {
      return {
        message: err.message,
        stack: err.stack,
      };
    }
    return {
      message: typeof err === "string" ? err : JSON.stringify(err),
    };
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const errorDetails = context?.error ? this.formatError(context.error) : undefined;

    const payload = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(context?.module ? { module: context.module } : {}),
      ...(context?.action ? { action: context.action } : {}),
      ...(context?.userId ? { userId: context.userId } : {}),
      ...(context?.ip ? { ip: context.ip } : {}),
      ...(errorDetails ? { error: errorDetails } : {}),
      ...(context?.metadata ? { metadata: context.metadata } : {}),
    };

    const line = JSON.stringify(payload);

    // 1. Console Output with clear tagging
    const colorTag =
      level === "error"
        ? "\x1b[31m[ERROR]\x1b[0m"
        : level === "warn"
        ? "\x1b[33m[WARN]\x1b[0m"
        : level === "info"
        ? "\x1b[36m[INFO]\x1b[0m"
        : "[DEBUG]";

    if (level === "error") {
      console.error(`${colorTag} [${timestamp}] ${message}`, payload);
    } else if (level === "warn") {
      console.warn(`${colorTag} [${timestamp}] ${message}`, payload);
    } else {
      console.log(`${colorTag} [${timestamp}] ${message}`, payload);
    }

    // 2. Persistent Rotating File Logging
    this.writeToFile(this.getLogFilename("combined"), line);
    if (level === "error") {
      this.writeToFile(this.getLogFilename("error"), line);
    }
  }

  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  debug(message: string, context?: LogContext) {
    this.log("debug", message, context);
  }

  /**
   * Logs an error to console, file, and optionally creates an AuditLog record in PostgreSQL
   * for immediate live visibility across dashboard and /audit pages.
   */
  async error(message: string, context?: LogContext, recordToDatabase = true) {
    this.log("error", message, context);

    if (recordToDatabase) {
      try {
        const errorInfo = context?.error ? this.formatError(context.error) : undefined;
        await recordAudit({
          actorId: context?.userId ?? null,
          action: context?.action || "system.error",
          entityType: "ERROR",
          entityId: context?.entityId ? String(context.entityId) : (context?.module || "SYSTEM"),
          metadata: {
            errorMessage: message,
            errorDetails: errorInfo,
            contextData: context?.metadata || {},
          },
        });
      } catch (dbErr) {
        // Fallback console log if DB insert fails
        console.error("[Logger] Failed to write error log to PostgreSQL audit table:", dbErr);
      }
    }
  }
}

export const logger = new SystemLogger();
