import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // 1. Handle known application errors
  if (err instanceof AppError) {
    logger.warn(`AppError: [${err.code}] ${err.message}`, {
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
      details: err.details,
    });

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || null,
      },
    });
  }

  // 2. Handle Prisma known errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn(`Prisma error: [${err.code}] ${err.message}`, { path: req.path });

    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      return res.status(409).json({
        error: {
          code: 'RESOURCE_CONFLICT',
          message: `A record with this ${target} already exists.`,
          details: err.meta,
        },
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Requested record was not found or has been deleted.',
          details: null,
        },
      });
    }
  }

  // 3. Fallback for unhandled internal exceptions
  logger.error(`Unhandled internal error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const isDev = env.NODE_ENV !== 'production';

  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message : 'An unexpected error occurred. Please try again later.',
      details: isDev ? { stack: err.stack } : null,
    },
  });
}
