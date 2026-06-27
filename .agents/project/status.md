# AI CS Roadmap Status

This file prevents duplicate work. Before starting a feature, check whether it is already implemented here and verify with code search.

## Implemented

- Kakao login and user-scoped data separation.
- One store record per user update flow.
- Store setup for business type, products, policies, owner review tone examples, and owner CS tone examples.
- Legacy tone inputs removed in favor of owner example based tone learning.
- CS reply generation, review reply generation, and batch review replies.
- AI CS workflow inbox with status tabs: needs review, pending approval, completed.
- Platform filter, source platform badges, platform status badges, handling type, risk level, and AI reason.
- Safe bulk approval for pending items with `handling_type = auto_ready` and `risk_level = low`.
- Missing-info learning: owner answers unknown questions, store knowledge is updated, and related CS messages can be regenerated.
- Store knowledge quality, usage tracking, correction learning, repeated correction handling, and stale knowledge review.
- AI activity logs and today's AI CS work summary.
- Paid adoption request flow and admin review panel.
- Paid-first public journey: free-trial/sample-demo language removed from the main UX.
- Coupang credentials, connection test, inquiry import, and reply registration API structure.
- Smartstore credentials, connection test, inquiry import, and reply registration API structure.
- Platform status lifecycle: `local`, `synced`, `posted`, `failed`.
- Cross-industry CS safety guards for price, stock, shipping, refund, reservation, business hours, health, allergy, safety, legal, and claim cases.
- UI cleanup toward a white/gray/blue/black SaaS style and reduced dense card copy.
- Agent harness files, verification commands, and commit/push policy.

## Remaining Gaps

- Real payment/subscription provider integration and production-grade paid entitlement enforcement.
- Production validation for Coupang and Smartstore API edge cases with real accounts.
- Real Baemin, Yogiyo, and Coupang Eats API integrations.
- Stronger Manager/Expert/Builder service-layer scaffolding inside the app runtime, beyond repository harness rules.
- More compact store setup and AI CS card UX without hiding critical information.
- Operations dashboard for owner trust: failure recovery, audit trail, and measurable savings.

## Current Priorities

1. Formalize the MoAI-ADK harness so future work always checks existing implementation, routes by domain, verifies safety, and avoids duplicate flows.
2. Add app-level Manager/Expert/Builder scaffolding for AI CS decisions: classify task, apply domain guardrails, build response/action, and record verification evidence.
3. Strengthen paid entitlement and conversion flow so unpaid users cannot rely on the production workload features without adoption approval or subscription.

## Standard Validation

- `npm run test:harness`
- `npm run test:cs-guard`
- `npm run test:workflow-safety`
- `npm run test:monetization`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
