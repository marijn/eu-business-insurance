import { APIError } from './apiError';
import { ErrorCode } from '../interfaces/schemas';

export class ValidationError extends APIError {
  public readonly fieldErrors: Record<string, string[]>;

  constructor(
    message: string = 'Validation failed',
    details?: Array<{ field?: string; message: string }>,
    trace_id?: string,
    statusCode?: number
  ) {
    super('VALIDATION_ERROR' as ErrorCode, message, details, trace_id, statusCode);
    
    Object.setPrototypeOf(this, ValidationError.prototype);
    
    this.name = 'ValidationError';
    this.fieldErrors = this.getFieldErrors();
  }

  public addFieldError(field: string, message: string): void {
    if (!this.fieldErrors[field]) {
      this.fieldErrors[field] = [];
    }
    this.fieldErrors[field].push(message);
  }

  public hasFieldError(field: string): boolean {
    return this.fieldErrors[field] !== undefined && this.fieldErrors[field].length > 0;
  }

  public getFieldErrorMessages(field: string): string[] {
    return this.fieldErrors[field] || [];
  }

  public getFieldsWithErrors(): string[] {
    return Object.keys(this.fieldErrors).filter(field => this.fieldErrors[field].length > 0);
  }

  public toUserFriendly(): { message: string; fieldErrors: Record<string, string[]> } {
    return {
      message: this.getUserMessage(),
      fieldErrors: this.fieldErrors,
    };
  }
}

export function createValidationError(
  fieldErrors: Record<string, string[]>,
  trace_id?: string
): ValidationError {
  const details = Object.entries(fieldErrors).map(([field, messages]) => {
    return messages.map(message => ({ field, message }));
  }).flat();

  return new ValidationError(
    'Validation failed',
    details,
    trace_id
  );
}

export function isValidationError(error: any): error is ValidationError {
  return error && error.name === 'ValidationError' && error.isAPIError === true;
}
