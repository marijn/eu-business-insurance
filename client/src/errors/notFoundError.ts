import { APIError } from './apiError';
import { ErrorCode } from '../interfaces/schemas';

export class NotFoundError extends APIError {
  public readonly resourceType: string;
  public readonly resourceId: string;

  constructor(
    resourceType: string,
    resourceId: string,
    message: string = 'Resource not found',
    trace_id?: string,
    statusCode?: number
  ) {
    super('NOT_FOUND' as ErrorCode, message, [], trace_id, statusCode);
    
    Object.setPrototypeOf(this, NotFoundError.prototype);
    
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }

  public getResourceMessage(): string {
    return `${this.resourceType} with ID '${this.resourceId}' not found`;
  }

  public isForResource(resourceType: string): boolean {
    return this.resourceType === resourceType;
  }

  public isForResourceId(resourceId: string): boolean {
    return this.resourceId === resourceId;
  }
}

export function createNotFoundError(
  resourceType: string,
  resourceId: string,
  trace_id?: string
): NotFoundError {
  return new NotFoundError(
    resourceType,
    resourceId,
    `${resourceType} with ID '${resourceId}' not found`,
    trace_id
  );
}

export function isNotFoundError(error: any): error is NotFoundError {
  return error && error.name === 'NotFoundError' && error.isAPIError === true;
}
