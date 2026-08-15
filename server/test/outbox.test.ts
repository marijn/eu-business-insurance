import { LocalDate } from '@js-joda/core';
import { StorageBackend } from '../src/storage/backend';
import { MemoryBackend } from '../src/storage/memory';
import { MySqlBackend } from '../src/storage/mysql';
import { Quote } from '../src/types';
import {QuoteForPolicyWasRequested} from "../src/closingDeals/domain/QuoteForPolicyWasRequested";

const quote: Quote = {
  id: 'quote_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  status: 'PENDING',
  premium: {
    gross: 119,
    net: 100,
    taxes: [
      {
        type: 'VAT',
        rate: 0.19,
        amount: 19
      }
    ],
    currency: 'EUR'
  },
  coverage: {
    limits: {
      per_claim: 1_000_000,
      aggregate: 2_000_000
    },
    deductible: 10_000,
    add_ons: ['DATA_BREACH_RESPONSE'],
    exclusions: []
  },
  underwriting: {
    risk_score: 0.3,
    requirements: ['CYBER_TRAINING'],
    exclusions: []
  },
  expiry_date: '2026-10-21T14:47:23.318Z',
  created_at: '2026-10-14T14:47:23.318Z',
  business_id: 'biz_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  policy_type: 'CYBER',
  term: {start_date: '2026-11-01', end_date: '2027-10-31'},
};

const quoteForPolicyWasRequested: QuoteForPolicyWasRequested = {
  _named: 'Quote for policy was requested',
  quote_id: 'quote_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  business_id: 'biz_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  policy_type: 'CYBER',
  term: {
    start_date: LocalDate.parse('2026-11-01'),
    end_date: LocalDate.parse('2027-10-31'),
  },
  coverage: {
    limits: {
      per_claim: 1_000_000,
      aggregate: 2_000_000
    },
    deductible: 10_000,
    add_ons: ['DATA_BREACH_RESPONSE'],
    exclusions: []
  },
  underwriting: {
    risk_score: 0.3,
    requirements: ['CYBER_TRAINING'],
    exclusions: []
  },
  premium: {
    gross: 119,
    net: 100,
    taxes: [
      {
        type: 'VAT',
        rate: 0.19,
        amount: 19
      }
    ],
    currency: 'EUR'
  },
  expiry_date: '2026-10-21T14:47:23.318Z',
  requested_by: {
    actor_id: 'user_cccccccccccccccccccccccccccccccc',
    originating_user_agent: 'Mozilla/5.0',
    originating_ip: '203.0.113.7'
  },
  requested_at: '2026-10-14T14:47:22.951Z',
};
const encodedQuoteForPolicyWasRequested = {
  _named: 'Quote for policy was requested',
  quote_id: 'quote_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  business_id: 'biz_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  policy_type: 'CYBER',
  term: {
    start_date: '2026-11-01',
    end_date: '2027-10-31',
  },
  coverage: {
    limits: {
      per_claim: 1_000_000,
      aggregate: 2_000_000
    },
    deductible: 10_000,
    add_ons: ['DATA_BREACH_RESPONSE'],
    exclusions: []
  },
  underwriting: {
    risk_score: 0.3,
    requirements: ['CYBER_TRAINING'],
    exclusions: []
  },
  premium: {
    gross: 119,
    net: 100,
    taxes: [
      {
        type: 'VAT',
        rate: 0.19,
        amount: 19
      }
    ],
    currency: 'EUR'
  },
  expiry_date: '2026-10-21T14:47:23.318Z',
  requested_by: {
    actor_id: 'user_cccccccccccccccccccccccccccccccc',
    originating_user_agent: 'Mozilla/5.0',
    originating_ip: '203.0.113.7'
  },
  requested_at: '2026-10-14T14:47:22.951Z',
};

const testTransactionalOutboxOfStorageBackend = (backend: StorageBackend) => {
  describe('outbox entries', () => {
    beforeAll(() => backend.init());
    beforeEach(() => backend.clear());
    afterAll(() => backend.close());

    it('is empty when no quote has been saved', async () => {
      expect(await backend.list('outbox_entries')).toEqual([]);
    });

    it('Quotes don\'t contain recorded events when fetched from the backend', async () => {
      await backend.put('quotes', quote.id, { ...quote, recordedEvents: [quoteForPolicyWasRequested] });

      expect(await backend.get('quotes', quote.id)).toEqual(quote);
    });

    it('Outbox contains previously recorded events', async () => {
      await backend.put('quotes', quote.id, { ...quote, recordedEvents: [quoteForPolicyWasRequested] });

      expect(await backend.list('outbox_entries')).toEqual([
        {
          id: expect.any(Number),
          payload: encodedQuoteForPolicyWasRequested,
          publishingStatus: 'pending',
        },
      ]);
    });

    it('rejects both the quote and the outbox entry when the outbox entry could not be persisted', async () => {
      const brokenEvent: Record<string, unknown> = { ...quoteForPolicyWasRequested };
      brokenEvent.self = brokenEvent;

      await expect(backend.put('quotes', quote.id, { ...quote, recordedEvents: [brokenEvent] })).rejects.toThrow();

      expect(await backend.get('quotes', quote.id)).toBeUndefined();
      expect(await backend.list('outbox_entries')).toEqual([]);
    });
  });
};

describe('memory storage', () => {
  testTransactionalOutboxOfStorageBackend(new MemoryBackend());
});

describe('MySQL storage', () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL to a MySQL database to run these tests, e.g. mysql://root@127.0.0.1:3306/test');
  testTransactionalOutboxOfStorageBackend(MySqlBackend.fromUrl(url));
});
