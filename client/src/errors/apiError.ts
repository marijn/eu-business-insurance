import { ErrorCode, Error as APIErrorInterface } from '../interfaces/schemas';

export class APIError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Array<{ field?: string; message: string }>;
  public readonly trace_id?: string;
  public readonly statusCode?: number;
  public readonly isAPIError = true;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Array<{ field?: string; message: string }>,
    trace_id?: string,
    statusCode?: number
  ) {
    super(message);
    
    Object.setPrototypeOf(this, APIError.prototype);
    
    this.name = 'APIError';
    this.code = code;
    this.details = details;
    this.trace_id = trace_id;
    this.statusCode = statusCode;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  public isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  public isAuthError(): boolean {
    return this.code === 'UNAUTHORIZED';
  }

  public isNotFound(): boolean {
    return this.code === 'NOT_FOUND';
  }

  public isRateLimited(): boolean {
    return this.code === 'RATE_LIMITED';
  }

  public isInternalError(): boolean {
    return this.code === 'INTERNAL_ERROR';
  }

  public toJSON(): APIErrorInterface {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      trace_id: this.trace_id,
    };
  }

  public getUserMessage(): string {
    switch (this.code) {
      case 'VALIDATION_ERROR':
        return 'Validation error: ' + this.message;
      case 'UNAUTHORIZED':
        return 'Authentication failed: ' + this.message;
      case 'NOT_FOUND':
        return 'Resource not found: ' + this.message;
      case 'RATE_LIMITED':
        return 'Too many requests. Please try again later.';
      case 'INTERNAL_ERROR':
        return 'An unexpected error occurred. Please try again.';
      default:
        return this.message;
    }
  }

  public getFieldErrors(): Record<string, string[]> {
    const fieldErrors: Record<string, string[]> = {};
    
    if (this.details) {
      for (const detail of this.details) {
        if (detail.field) {
          if (!fieldErrors[detail.field]) {
            fieldErrors[detail.field] = [];
          }
          fieldErrors[detail.field].push(detail.message);
        }
      }
    }
    
    return fieldErrors;
  }
}

export function createAPIErrorFromResponse(
  error: any,
  defaultMessage: string = 'An error occurred'
): APIError {
  if (error.response) {
    const responseData = error.response.data;
    
    if (responseData && typeof responseData === 'object') {
      return new APIError(
        responseData.code as ErrorCode || 'INTERNAL_ERROR',
        responseData.message || defaultMessage,
        responseData.details,
        responseData.trace_id,
        error.response.status
      );
    }
  }
  
  return new APIError(
    'INTERNAL_ERROR',
    error.message || defaultMessage,
    [],
    undefined,
    error.statusCode || 0
  );
}

export function isAPIError(error: any): error is APIError {
  return error && error.isAPIError === true;
}
