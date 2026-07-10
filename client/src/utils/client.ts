import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { APIConfig, DEFAULT_CONFIG } from './config';
import { AuthConfig, AuthManager, createAuthenticatedAxios } from './auth';
import { Error as APIErrorInterface } from '../interfaces/schemas';
import { APIError } from '../errors/apiError';
import { AuthError } from '../errors/authError';
import { NotFoundError } from '../errors/notFoundError';
import { ValidationError } from '../errors/validationError';
import { ErrorCode } from '../interfaces/enums';

export interface ClientTransport {
  axiosInstance: AxiosInstance;
  authManager: AuthManager | null;
}

export interface BaseClientConfig {
  apiConfig?: APIConfig;
  authConfig?: AuthConfig;
  tokenRefreshCallback?: () => Promise<string>;
  transport?: ClientTransport;
}

export interface APIResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface APIErrorResponse {
  error: unknown;
  status: number;
  headers?: Record<string, string>;
}

export class BaseAPIClient {
  protected readonly axiosInstance: AxiosInstance;
  protected readonly authManager: AuthManager | null;

  constructor(config: BaseClientConfig = {}) {
    const apiConfig = config.apiConfig || DEFAULT_CONFIG;

    if (config.transport) {
      this.axiosInstance = config.transport.axiosInstance;
      this.authManager = config.transport.authManager;
    } else if (config.authConfig) {
      this.authManager = new AuthManager(config.authConfig, config.tokenRefreshCallback);
      this.axiosInstance = createAuthenticatedAxios(
        config.authConfig,
        apiConfig,
        config.tokenRefreshCallback,
        this.authManager
      );
    } else {
      this.axiosInstance = axios.create(apiConfig);
      this.authManager = null;
    }
  }

  protected async request<T>(
    method: 'get' | 'post' | 'patch' | 'delete',
    url: string,
    data?: unknown,
    params?: Record<string, unknown>,
    config?: AxiosRequestConfig
  ): Promise<APIResponse<T>> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.request({
        method,
        url,
        data,
        params,
        ...config,
      });

      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const responseData = axiosError.response.data as APIErrorInterface | { error: APIErrorInterface } | undefined;
        const errorData = typeof responseData !== 'object' || responseData === null
          ? undefined
          : 'code' in responseData && 'message' in responseData
            ? responseData
            : 'error' in responseData
              ? responseData.error
              : undefined;

        const code: ErrorCode = errorData?.code ?? 'INTERNAL_ERROR';
        const message = errorData?.message ?? (axiosError.message || 'Unknown error occurred');
        const details = errorData?.details ?? [];
        const traceId = errorData?.trace_id;
        const statusCode = axiosError.response.status;

        switch (code) {
          case 'VALIDATION_ERROR':
            throw new ValidationError(message, details, traceId, statusCode);
          case 'UNAUTHORIZED':
            throw new AuthError(message, statusCode !== 403, traceId, statusCode);
          case 'NOT_FOUND': {
            const [resourceType = 'resource', resourceId = ''] = url.split('?')[0].split('/').filter(Boolean);
            throw new NotFoundError(resourceType, resourceId, message, traceId, statusCode);
          }
          default:
            throw new APIError(code, message, details, traceId, statusCode);
        }
      }

      if (axiosError.request) {
        throw new APIError('INTERNAL_ERROR', 'Network error - no response received', [], undefined, 0);
      }

      throw new APIError('INTERNAL_ERROR', axiosError.message || 'Unknown error occurred', [], undefined, 0);
    }
  }

  protected async get<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    return this.request('get', url, undefined, params, config);
  }

  protected async post<T>(url: string, data?: unknown, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    return this.request('post', url, data, params, config);
  }

  protected async patch<T>(url: string, data?: unknown, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    return this.request('patch', url, data, params, config);
  }

  protected async delete<T>(url: string, data?: unknown, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<APIResponse<T>> {
    return this.request('delete', url, data, params, config);
  }

  public getAuthManager(): AuthManager | null {
    return this.authManager;
  }

  public setToken(token: string, scopes?: string[]): void {
    if (this.authManager) {
      this.authManager.setToken(token, scopes);
    }
  }

  public setAPIKey(key: string): void {
    if (this.authManager) {
      this.authManager.setAPIKey(key);
    }
  }

  public clearAuth(): void {
    if (this.authManager) {
      this.authManager.clear();
    }
  }
}

export function createAPIClient(apiConfig?: APIConfig): BaseAPIClient {
  return new BaseAPIClient({ apiConfig });
}

export function createAuthenticatedAPIClient(
  authConfig: AuthConfig,
  apiConfig?: APIConfig,
  tokenRefreshCallback?: () => Promise<string>
): BaseAPIClient {
  return new BaseAPIClient({ apiConfig, authConfig, tokenRefreshCallback });
}
