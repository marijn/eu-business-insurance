import { v4 as uuidv4 } from 'uuid';

const prefixes = {
  quote: 'quote',
  policy: 'pol',
  agreement: 'agreement',
  invoice: 'inv',
  payment: 'pay',
  paymentMethod: 'pm',
  claim: 'claim',
  payout: 'payout',
  document: 'doc',
  endorsement: 'end',
  adjudication: 'adj',
  refund: 'refund',
  audit: 'audit',
  assessment: 'uwa',
  erasure: 'erasure',
  report: 'report',
} as const;

export type IdType = keyof typeof prefixes;

export type GenerateId = (type: IdType) => string

export function generateId(type: IdType): string {
  return `${prefixes[type]}_${uuidv4().replace(/-/g, '')}`;
}

export function generateClaimNumber(): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `CL-${year}-${randomNum}`;
}

export type QuoteId = `quote_${string}`
