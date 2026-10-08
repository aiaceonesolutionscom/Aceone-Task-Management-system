/**
 * Application error hierarchy.
 * Every error that can reach the UI should be an AppError so that raw
 * database/internal details are never leaked to users.
 */

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Invalid email or password.") {
    super(message);
    this.name = "AuthError";
  }
}

export class PermissionError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "PermissionError";
  }
}

export class ValidationError extends AppError {
  readonly issues: Record<string, string>;
  constructor(
    message: string,
    issues: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}