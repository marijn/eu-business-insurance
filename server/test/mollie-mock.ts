import { MollieGateway, MollieMandate, MolliePayment, MollieRefund } from '../src/services/mollie';

export interface MollieMock extends MollieGateway {
  payments: Map<string, MolliePayment>;
  mandates: Map<string, MollieMandate>;
  refunds: Map<string, MollieRefund[]>;
  nextRecurringStatus: string;
  nextRefundStatus: string;
  completeFirstPayment(paymentId: string, card: { cardNumber: string; cardLabel: string; cardHolder: string }): void;
  setPaymentStatus(paymentId: string, status: string): void;
  setRefundStatus(paymentId: string, status: string): void;
}

export function createMollieMock(): MollieMock {
  let counter = 0;
  const next = (prefix: string) => `${prefix}_mock${++counter}`;

  const mock: MollieMock = {
    payments: new Map(),
    mandates: new Map(),
    refunds: new Map(),
    nextRecurringStatus: 'paid',
    nextRefundStatus: 'refunded',

    createCustomer: jest.fn(async () => ({ id: next('cst') })),

    createDirectDebitMandate: jest.fn(async (params) => {
      const mandate: MollieMandate = {
        id: next('mdt'),
        status: 'valid',
        details: { consumerAccount: params.consumerAccount },
      };
      mock.mandates.set(mandate.id, mandate);
      return mandate;
    }),

    getMandate: jest.fn(async (_customerId, mandateId) => {
      const mandate = mock.mandates.get(mandateId);
      if (!mandate) throw new Error(`No mandate ${mandateId}`);
      return mandate;
    }),

    createPayment: jest.fn(async (params) => {
      const id = next('tr');
      const payment: MolliePayment = {
        id,
        status: params.sequenceType === 'first' ? 'open' : mock.nextRecurringStatus,
        customerId: params.customerId,
        mandateId: params.mandateId,
        metadata: params.metadata,
        checkoutUrl: params.sequenceType === 'first' ? `https://www.mollie.com/checkout/select-method/${id}` : null,
      };
      mock.payments.set(id, payment);
      return { ...payment };
    }),

    getPayment: jest.fn(async (paymentId) => {
      const payment = mock.payments.get(paymentId);
      if (!payment) throw new Error(`No payment ${paymentId}`);
      return { ...payment };
    }),

    createRefund: jest.fn(async (paymentId) => {
      const refund: MollieRefund = { id: next('re'), status: mock.nextRefundStatus };
      mock.refunds.set(paymentId, [...(mock.refunds.get(paymentId) || []), refund]);
      return { ...refund };
    }),

    listRefunds: jest.fn(async (paymentId) => (mock.refunds.get(paymentId) || []).map((r) => ({ ...r }))),

    completeFirstPayment(paymentId, card) {
      const mandate: MollieMandate = { id: next('mdt'), status: 'valid', details: card };
      mock.mandates.set(mandate.id, mandate);
      mock.payments.set(paymentId, { ...mock.payments.get(paymentId)!, status: 'paid', mandateId: mandate.id });
    },

    setPaymentStatus(paymentId, status) {
      mock.payments.set(paymentId, { ...mock.payments.get(paymentId)!, status });
    },

    setRefundStatus(paymentId, status) {
      mock.refunds.set(paymentId, (mock.refunds.get(paymentId) || []).map((r) => ({ ...r, status })));
    },
  };
  return mock;
}
