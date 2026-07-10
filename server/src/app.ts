import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bodyParser from 'body-parser';

import { quotesRouter } from './routes/quotes';
import { policiesRouter } from './routes/policies';
import { agreementsRouter } from './routes/agreements';
import { invoicesRouter } from './routes/invoices';
import { claimsRouter } from './routes/claims';
import { payoutsRouter } from './routes/payouts';
import { underwritingRouter } from './routes/underwriting';
import { complianceRouter } from './routes/compliance';
import { documentsRouter } from './routes/documents';
import { paymentMethodsRouter } from './routes/paymentMethods';
import { dunningRouter } from './routes/dunning';
import { webhooksRouter } from './routes/webhooks';

import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authenticate, authorize, authorizeResource, rateLimit } from './middleware/auth';

const app = express();

app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-KEY'],
}));
app.use(bodyParser.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    (req as express.Request).rawBody = buf;
  },
}));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use('/v1/webhooks', webhooksRouter);

app.use(rateLimit(
  Number(process.env.RATE_LIMIT_MAX) || 100,
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000
));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.get('/', (req, res) => {
  res.json({
    name: 'EU Business Insurance Platform API',
    version: '1.0.0',
    description: 'End-to-end API for selling, managing, and servicing Cyber Liability, D&O, Surety Bonds, and Workers Compensation policies in the EU',
    docs: '/docs',
  });
});

app.use('/v1', authenticate);

app.use('/v1/quotes', authorizeResource('policy'), quotesRouter);
app.use('/v1/policies', authorizeResource('policy'), policiesRouter);
app.use('/v1/agreements', authorizeResource('policy'), agreementsRouter);
app.use('/v1/invoices', authorizeResource('billing'), invoicesRouter);
app.use('/v1/payment-methods', authorizeResource('billing'), paymentMethodsRouter);
app.use('/v1/dunning', authorizeResource('billing'), dunningRouter);
app.use('/v1/claims', authorizeResource('claims'), claimsRouter);
app.use('/v1/payouts', authorizeResource('payouts'), payoutsRouter);
app.use('/v1/underwriting', authorize('underwriting:read'), underwritingRouter);
app.use('/v1/compliance', authorizeResource('compliance'), complianceRouter);
app.use('/v1/documents', authorizeResource('documents'), documentsRouter);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;
