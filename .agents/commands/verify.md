# Verification Commands

Base verification:

```bash
npm run test:harness
npm run test:cs-guard
npx tsc --noEmit
npm run lint
npm run build
```

Task-specific verification:

```bash
npm run test:learning
npm run test:workflow-safety
npm run test:monetization
npm run test:store-knowledge-quality
npm run test:store-knowledge-usage
```

Rules:

- CS reply, safety, platform inquiry, reply generation, or learning changes must include `npm run test:cs-guard`.
- Missing info, correction learning, store knowledge quality, and knowledge usage changes should include `npm run test:learning`, `npm run test:store-knowledge-quality`, and `npm run test:store-knowledge-usage` when relevant.
- Paid adoption, billing, conversion, entitlement, or trial-removal changes must include `npm run test:monetization`.
- AI CS workflow inbox UI/state changes must include `npm run test:workflow-safety`.
- Harness or agent-rule changes must include `npm run test:harness`.
- If `next build` fails only because Google Fonts cannot be fetched, rerun the same build with network access and report that reason.
