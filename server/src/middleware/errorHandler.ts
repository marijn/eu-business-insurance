import { Request, Response, NextFunction } from 'express';
import { Error as ApiError, ErrorCode } from '../types';

class APIError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Array<{ field: string; message: string }>,
    public traceId?: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function createError(
  code: ErrorCode,
  message: string,
  details?: Array<{ field: string; message: string }>,
  statusCode?: number
): APIError {
  return new APIError(
    code,
    message,
    details,
    undefined,
    statusCode || {
      VALIDATION_ERROR: 400,
      UNAUTHORIZED: 401,
      NOT_FOUND: 404,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
    }[code]
  );
}

export function notFound(resource: string): APIError {
  return createError('NOT_FOUND', `${resource} not found`);
}

export function badRequest(message: string, field?: string): APIError {
  return createError('VALIDATION_ERROR', message, field ? [{ field, message }] : undefined);
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof APIError) {
    const errorResponse: ApiError = {
      code: err.code,
      message: err.message,
    };
    
    if (err.details) {
      errorResponse.details = err.details;
    }
    
    if (err.traceId) {
      errorResponse.trace_id = err.traceId;
    }
    
    return res.status(err.statusCode).json(errorResponse);
  }
  
  if (err.name === 'ZodError') {
    const errorResponse: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: (err as any).errors?.map((e: any) => ({
        field: e.path?.join('.') || 'unknown',
        message: e.message,
      })),
    };
    return res.status(400).json(errorResponse);
  }
  
  if (err.name === 'MulterError') {
    const errorResponse: ApiError = {
      code: 'VALIDATION_ERROR',
      message: err.message,
    };
    return res.status(400).json(errorResponse);
  }

  if ((err as any).type === 'entity.parse.failed') {
    const errorResponse: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Malformed JSON body',
    };
    return res.status(400).json(errorResponse);
  }
  
  if (err.name === 'JsonWebTokenError') {
    const errorResponse: ApiError = {
      code: 'UNAUTHORIZED',
      message: 'Invalid token',
    };
    return res.status(401).json(errorResponse);
  }
  
  if (err.name === 'TokenExpiredError') {
    const errorResponse: ApiError = {
      code: 'UNAUTHORIZED',
      message: 'Token expired',
    };
    return res.status(401).json(errorResponse);
  }
  
  if (err.message.includes('not found') || err.message.includes('NotFound')) {
    const errorResponse: ApiError = {
      code: 'NOT_FOUND',
      message: err.message,
    };
    return res.status(404).json(errorResponse);
  }
  
  console.error('Unhandled error:', err);
  const errorResponse: ApiError = {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    trace_id: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };
  
  return res.status(500).json(errorResponse);
}

export function notFoundHandler(req: Request, res: Response) {
  const errorResponse: ApiError = {
    code: 'NOT_FOUND',
    message: 'Resource not found',
  };
  res.status(404).json(errorResponse);
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export { APIError };
