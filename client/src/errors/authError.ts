import { APIError } from './apiError';
import { ErrorCode } from '../interfaces/schemas';

export class AuthError extends APIError {
  public readonly requiresReauthentication: boolean;

  constructor(
    message: string = 'Authentication failed',
    requiresReauthentication: boolean = true,
    trace_id?: string,
    statusCode?: number
  ) {
    super('UNAUTHORIZED' as ErrorCode, message, [], trace_id, statusCode);
    
    Object.setPrototypeOf(this, AuthError.prototype);
    
    this.name = 'AuthError';
    this.requiresReauthentication = requiresReauthentication;
  }

  public isTokenExpired(): boolean {
    return this.message.toLowerCase().includes('expired') ||
           this.message.toLowerCase().includes('token') &&
           this.message.toLowerCase().includes('expired');
  }

  public isInsufficientScope(): boolean {
    return this.message.toLowerCase().includes('scope') ||
           this.message.toLowerCase().includes('permission') ||
           this.message.toLowerCase().includes('insufficient');
  }

  public isInvalidToken(): boolean {
    return this.message.toLowerCase().includes('invalid') &&
           this.message.toLowerCase().includes('token');
  }

  public getAction(): 'refresh_token' | 'reauthenticate' | 'check_scopes' {
    if (this.isTokenExpired()) {
      return 'refresh_token';
    }
    if (this.isInsufficientScope()) {
      return 'check_scopes';
    }
    return 'reauthenticate';
  }
}

export function createAuthError(
  message: string = 'Authentication failed',
  requiresReauthentication: boolean = true,
  trace_id?: string,
  statusCode?: number
): AuthError {
  return new AuthError(message, requiresReauthentication, trace_id, statusCode);
}

export function isAuthError(error: any): error is AuthError {
  return error && error.name === 'AuthError' && error.isAPIError === true;
}
