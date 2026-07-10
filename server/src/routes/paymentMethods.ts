import { Router } from 'express';
import { generateId } from '../utils/idGenerator';
import { storage } from '../storage';
import { asyncHandler } from '../middleware/errorHandler';
import { validateSchema, paymentMethodRequestSchema } from '../utils/validation';
import { PaymentMethod, PaymentMethodStatus } from '../types';
import { clock, today } from '../utils/clock';
import { audit } from '../services/audit';
import { callMollie, mollie, mollieAmount, webhookUrl } from '../services/mollie';

const router = Router();

const MANDATE_STATUS: Record<string, PaymentMethodStatus> = { valid: 'ACTIVE', pending: 'PENDING', invalid: 'INVALID' };
const CARD_VERIFICATION_AMOUNT = 0.01;

router.post('/', asyncHandler(async (req, res) => {
  const request = validateSchema(paymentMethodRequestSchema, req.body);
  const gateway = mollie();

  let customerId = await storage.getMollieCustomerId(request.business_id);
  if (!customerId) {
    customerId = (await callMollie(() => gateway.createCustomer({
      name: request.details.holder_name,
      email: request.email,
      metadata: { business_id: request.business_id },
    }))).id;
    await storage.setMollieCustomerId(request.business_id, customerId);
  }

  const id = generateId('paymentMethod');
  const base = {
    id,
    business_id: request.business_id,
    type: request.type,
    mollie_customer_id: customerId,
    created_at: clock.now().toISOString(),
  };

  let paymentMethod: Omit<PaymentMethod, 'is_default'>;
  if (request.type === 'SEPA') {
    const mandate = await callMollie(() => gateway.createDirectDebitMandate({
      customerId: customerId!,
      consumerName: request.details.holder_name,
      consumerAccount: request.details.iban!,
      consumerBic: request.details.bic!,
      signatureDate: today(),
      mandateReference: id,
    }));
    paymentMethod = {
      ...base,
      details: { holder_name: request.details.holder_name, masked_iban: `****${request.details.iban!.slice(-4)}` },
      status: MANDATE_STATUS[mandate.status] || 'PENDING',
      mollie_mandate_id: mandate.id,
    };
  } else {
    const firstPayment = await callMollie(() => gateway.createPayment({
      amount: mollieAmount(CARD_VERIFICATION_AMOUNT, 'EUR'),
      description: `Card verification ${id}`,
      customerId: customerId!,
      sequenceType: 'first',
      method: 'creditcard',
      redirectUrl: request.redirect_url,
      webhookUrl: webhookUrl(),
      metadata: { payment_method_id: id },
    }));
    paymentMethod = {
      ...base,
      details: { holder_name: request.details.holder_name },
      status: 'PENDING',
      checkout_url: firstPayment.checkoutUrl || undefined,
      mollie_payment_id: firstPayment.id,
    };
  }

  const existing = (await storage.listPaymentMethods()).filter(pm => pm.business_id === request.business_id);
  const isDefault = request.is_default || existing.length === 0;
  if (isDefault) {
    for (const pm of existing.filter(pm => pm.is_default)) {
      await storage.updatePaymentMethod(pm.id, { is_default: false });
    }
  }

  const created = await storage.createPaymentMethod({ ...paymentMethod, is_default: isDefault });

  await audit(req, 'PAYMENT_METHOD_ADDED', 'PAYMENT_METHOD', id, {
    business_id: request.business_id,
    type: request.type,
    status: created.status,
    is_default: isDefault,
  });

  res.status(201).json(created);
}));

router.get('/', asyncHandler(async (req, res) => {
  const { business_id } = req.query;

  let paymentMethods = await storage.listPaymentMethods();
  if (business_id) paymentMethods = paymentMethods.filter(pm => pm.business_id === business_id);

  res.json({ payment_methods: paymentMethods });
}));

export { router as paymentMethodsRouter };
