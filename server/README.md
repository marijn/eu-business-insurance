# Server

Express/TypeScript implementation of `../openapi.yaml`.

```bash
npm install
npm run build
npm start      # http://localhost:3000, health check at /health
npm test       # Jest API tests
npm run lint
```

`requests.http` walks through quote → policy → signing → invoice → payment → claim → payout (VS Code REST Client).

## Policy lifecycle

A bound quote creates a `PENDING` policy and a policy agreement. The policy becomes `ACTIVE` when DocuSign reports the agreement signed, and claims are only accepted from then on. An `ACTIVE` policy becomes `EXPIRED` after its term ends.

Endorsements and renewals also wait for a signature. An endorsement is `PENDING` until its agreement is signed, then its changes are applied; a declined or voided agreement cancels it. A renewal creates a `PENDING` policy; once it is signed, it becomes `ACTIVE` and the old policy `RENEWED`.

## Configuration

| Variable | Default |
|----------|---------|
| `PORT` | `3000` |
| `STORAGE` | `memory`; set `mysql` to use MySQL |
| `DATABASE_URL` | required for `STORAGE=mysql`, e.g. `mysql://user:pass@host:3306/insurance`; tables are created on start |
| `MOLLIE_API_KEY` | none; payment endpoints answer `503` until set |
| `PUBLIC_BASE_URL` | none; when set, Mollie webhooks go to `<PUBLIC_BASE_URL>/v1/webhooks/mollie` |
| `API_KEY` | `test-api-key-1,test-api-key-2` |
| `JWT_SECRET` | development secret |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `100` per `60000` ms |
| `DOCUSIGN_CONNECT_HMAC_KEYS` | none; the webhook rejects all deliveries until set |
| `DOCUSIGN_CONNECT_SKIP_VERIFY` | `false`; `true` accepts DocuSign webhooks without a valid signature, for local use only |

## Authentication

Send `X-API-KEY` (all scopes) or `Authorization: Bearer <JWT>`. A JWT needs `<resource>:read` for `GET` and `<resource>:write` otherwise, for `policy`, `billing`, `claims`, `payouts`, `compliance` and `documents`. Underwriting needs `underwriting:read`, and adjusting a quote's underwriting also `underwriting:write`; adjudicating a claim also needs `claims:adjudicate`.

## Payments (Mollie)

Premiums are charged on demand with Mollie recurring payments:

1. `POST /payment-methods` creates a Mollie customer for the business (once) and a mandate. `SEPA` creates a Direct Debit mandate from the IBAN. `CARD` returns a `checkout_url` for a first payment; the method becomes `ACTIVE` when Mollie reports it paid.
2. `POST /invoices/{id}/pay` creates a `recurring` Mollie payment on that mandate.
3. Mollie calls `POST /v1/webhooks/mollie` with `id=tr_…` whenever a payment's status changes. The server fetches that payment from Mollie and updates the payment, its refunds and the invoice (`PAID`, `REFUNDED`). `requests.http` sends this call by hand.

Refunds are created on the invoice's Mollie payments.

## Examples

`test/readme-examples.test.ts` runs both:

- **Payment:** a €6,485.50 invoice (€5,450 + 19% VAT) paid as €2,000 + €4,485.50 becomes `PAID`. Overpaying, another business's payment method or a different currency is rejected. If unpaid after the due date, it becomes `OVERDUE` and can be dunned three times.
- **Payout:** a claim approved for €450,000 can be paid out up to that amount. A payout settles after two days, and the claim becomes `PAID` once €450,000 has settled.

## DocuSign

`POST /v1/webhooks/docusign` accepts DocuSign Connect JSON events signed with `X-DocuSign-Signature-N`. Completed, declined and voided events set the agreement to `SIGNED`, `DECLINED` or `VOIDED`.

The DocuSign request in `requests.http` is unsigned, and the claim steps after it need the policy it activates, so start the server with `DOCUSIGN_CONNECT_SKIP_VERIFY=true` to run the file.
