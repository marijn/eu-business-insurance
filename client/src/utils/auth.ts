import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosHeaders } from 'axios';
import { APIConfig, DEFAULT_CONFIG } from './config';

export interface BearerAuthConfig {
  type: 'bearer';
  token: string;
  scopes?: string[];
}

export interface APIKeyAuthConfig {
  type: 'apiKey';
  key: string;
}

export type AuthConfig = BearerAuthConfig | APIKeyAuthConfig;

export type TokenRefreshCallback = () => Promise<string>;

export class AuthManager {
  private token: string | null = null;
  private apiKey: string | null = null;
  private scopes: string[] = [];
  private tokenRefreshCallback: TokenRefreshCallback | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly config: AuthConfig,
    tokenRefreshCallback?: TokenRefreshCallback
  ) {
    if (config.type === 'bearer') {
      this.token = config.token;
      this.scopes = config.scopes || [];
      this.tokenRefreshCallback = tokenRefreshCallback || null;
      this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    } else if (config.type === 'apiKey') {
      this.apiKey = config.key;
    }
  }

  public async getToken(): Promise<string | null> {
    if (!this.token) return null;

    if (this.tokenExpiry && new Date() > new Date(this.tokenExpiry.getTime() - 5 * 60 * 1000)) {
      if (this.tokenRefreshCallback) {
        try {
          this.token = await this.tokenRefreshCallback();
          this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
        } catch {
          return this.token;
        }
      }
    }

    return this.token;
  }

  public getAPIKey(): string | null {
    return this.apiKey;
  }

  public getScopes(): string[] {
    return this.scopes;
  }

  public hasScope(scope: string): boolean {
    return this.scopes.includes(scope);
  }

  public setToken(token: string, scopes?: string[]): void {
    this.token = token;
    this.scopes = scopes || [];
    this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
  }

  public setAPIKey(key: string): void {
    this.apiKey = key;
  }

  public clear(): void {
    this.token = null;
    this.apiKey = null;
    this.scopes = [];
    this.tokenExpiry = null;
  }

  public async applyAuth(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    const requestConfig = { ...config };

    if (this.token) {
      const currentToken = await this.getToken();
      if (currentToken) {
        requestConfig.headers = {
          ...requestConfig.headers,
          Authorization: `Bearer ${currentToken}`,
        } as unknown as AxiosHeaders;
      }
    }

    if (this.apiKey) {
      requestConfig.headers = {
        ...requestConfig.headers,
        'X-API-KEY': this.apiKey,
      } as unknown as AxiosHeaders;
    }

    return requestConfig;
  }
}

export function createAuthenticatedAxios(
  authConfig: AuthConfig,
  apiConfig: APIConfig = DEFAULT_CONFIG,
  tokenRefreshCallback?: TokenRefreshCallback,
  authManager: AuthManager = new AuthManager(authConfig, tokenRefreshCallback)
): AxiosInstance {
  const axiosInstance = axios.create(apiConfig);

  axiosInstance.interceptors.request.use(
    async (config) => {
      return authManager.applyAuth(config);
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && 
          authConfig.type === 'bearer' && 
          tokenRefreshCallback &&
          !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const newToken = await tokenRefreshCallback();
          authManager.setToken(newToken, authManager.getScopes());
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        } catch {
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
}

export function createBearerTokenAuth(token: string, scopes?: string[]): AuthConfig {
  return {
    type: 'bearer',
    token,
    scopes,
  };
}

export function createAPIKeyAuth(key: string): AuthConfig {
  return {
    type: 'apiKey',
    key,
  };
}
