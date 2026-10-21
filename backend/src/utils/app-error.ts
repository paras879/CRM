export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED', details?: unknown) {
    return new AppError(401, code, message, details);
  }

  static forbidden(message = 'Access denied. You do not have permission for this action', code = 'FORBIDDEN', details?: unknown) {
    return new AppError(403, code, message, details);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND', details?: unknown) {
    return new AppError(404, code, message, details);
  }

  static conflict(message: string, code = 'CONFLICT', details?: unknown) {
    return new AppError(409, code, message, details);
  }

  static unprocessable(message: string, code = 'UNPROCESSABLE_ENTITY', details?: unknown) {
    return new AppError(422, code, message, details);
  }

  static internal(message = 'Internal server error', code = 'INTERNAL_ERROR', details?: unknown) {
    return new AppError(500, code, message, details);
  }
}
