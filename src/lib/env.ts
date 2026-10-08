import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  AUTH_COOKIE_NAME: z.string().min(1).default("aceone.session"),
  APP_URL: z.string().url().optional(),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SESSION_TTL_DAYS: process.env.AUTH_SESSION_TTL_DAYS,
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
  APP_URL: process.env.APP_URL,
});