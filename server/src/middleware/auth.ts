import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Error } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-12345';

const API_KEYS = new Set<string>(
  process.env.API_KEY
    ? process.env.API_KEY.split(',').map((key) => key.trim()).filter(Boolean)
    : ['test-api-key-1', 'test-api-key-2']
);

export const ALL_SCOPES = [
  'policy:read', 'policy:write',
  'billing:read', 'billing:write',
  'claims:read', 'claims:write', 'claims:adjudicate',
  'payouts:read', 'payouts:write',
  'underwriting:read', 'underwriting:write',
  'compliance:read', 'compliance:write',
  'documents:read', 'documents:write',
];

const API_KEY_USER: JwtPayload = {
  userId: 'api-user',
  email: 'api@insureeu.com',
  scopes: ALL_SCOPES,
};

export interface JwtPayload {
  userId: string;
  email?: string;
  business_id?: string;
  scopes: string[];
  iat?: number;
  exp?: number;
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    let payload: JwtPayload | undefined;
    try {
      payload = jwt.verify(authHeader.substring(7), JWT_SECRET) as JwtPayload;
    } catch {
      payload = undefined;
    }
    if (payload) {
      req.user = payload;
      return next();
    }
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    } as Error);
  }

  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey && API_KEYS.has(apiKey)) {
    req.user = API_KEY_USER;
    return next();
  }

  return res.status(401).json({
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
  } as Error);
}

export function authorize(requiredScopes: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;

    if (!user) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      } as Error);
    }

    const missing = (Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes])
      .filter(scope => !(user.scopes || []).includes(scope));
    if (missing.length > 0) {
      return res.status(403).json({
        code: 'UNAUTHORIZED',
        message: `Insufficient permissions: requires ${missing.join(', ')}`,
      } as Error);
    }

    next();
  };
}

export function authorizeResource(resource: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const access = req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write';
    return authorize(`${resource}:${access}`)(req, res, next);
  };
}

const rateLimits = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const limit = rateLimits.get(ip) || { count: 0, resetTime: 0 };
    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + windowMs;
    }

    if (limit.count >= maxRequests) {
      return res.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      } as Error);
    }

    limit.count++;
    rateLimits.set(ip, limit);
    next();
  };
}
