# Client

TypeScript client for the API in `../openapi.yaml`.

```bash
npm install    # also builds dist/
npm run lint
```

## Usage

```typescript
import { EUBusinessInsuranceClient, LOCAL_CONFIG, isAPIError } from './src';

const client = EUBusinessInsuranceClient.createWithAPIKey('test-api-key-1', LOCAL_CONFIG);

const policies = await client.policy.listPolicies({ business_id: 'biz_12345' });

try {
  await client.policy.getPolicy('pol_missing');
} catch (error) {
  if (isAPIError(error) && error.isNotFound()) console.log('not found');
}
```

Services: `policy`, `agreement`, `billing`, `claims`, `payouts`, `underwriting`, `compliance`, `documents`. Use `createWithBearerToken(token)` for JWT authentication.

## Example

With the server running (`cd ../server && npm run build && npm start`):

```bash
npm run example
```

This runs `examples/workflow.ts` against `http://localhost:3000/v1`: quote, policy, agreement, invoice, payment, claim, payout, audit trail, documents and error handling.
