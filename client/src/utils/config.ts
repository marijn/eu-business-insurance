export interface APIConfig {
  baseURL: string;
  timeout?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

export const DEFAULT_CONFIG: APIConfig = {
  baseURL: 'https://api.insureeu.com/v1',
  timeout: 30000,
  maxRedirects: 5,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

export const STAGING_CONFIG: APIConfig = {
  baseURL: 'https://staging-api.insureeu.com/v1',
  timeout: 30000,
  maxRedirects: 5,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

export const LOCAL_CONFIG: APIConfig = {
  baseURL: 'http://localhost:3000/v1',
  timeout: 30000,
  maxRedirects: 5,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

export function getConfig(environment: 'production' | 'staging' | 'local' = 'production'): APIConfig {
  switch (environment) {
    case 'staging':
      return STAGING_CONFIG;
    case 'local':
      return LOCAL_CONFIG;
    default:
      return DEFAULT_CONFIG;
  }
}
