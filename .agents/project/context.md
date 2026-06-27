# AI CS Project Context

## Mission

Build a revenue-generating AI CS employee for store owners.

The product is not a simple reply generator. It should receive customer inquiries and reviews, decide whether AI can answer safely, ask the owner only when needed, learn from the owner's correction or missing information, and keep working through the AI CS workflow inbox.

## Product Direction

- Paid-first product: public-facing flows should lead to paid adoption, platform integration, and real workload reduction.
- Do not present the product as a free-trial or sample-demo toy. Internal mock routes may remain for regression tests, but the main UX should emphasize actual setup and paid operations.
- Store owners should understand the next action immediately: connect platform, register store knowledge, review pending/high-risk items, or approve safe items.
- AI must never invent operational facts. Price, inventory, quantity, business hours, shipping availability, pickup, reservation, refund, health, safety, legal, and claim answers require explicit store knowledge or policy.
- Owner corrections and missing-info answers become reusable store knowledge and should update related pending CS messages when safe.
- Platform work should prioritize revenue paths: Coupang and Smartstore actual inquiry flows first, then Baemin/Yogiyo/Coupang Eats production integrations.

## MoAI-ADK Harness Model

We adapt the reference MoAI-ADK idea into this repository as a development harness.

- Manager Agent: classify each request by goal, risk, domain, and whether it already exists. Decide which implementation path to use without asking the user to choose an agent.
- Expert Agent: apply domain rules for CS safety, store knowledge, platform integration, monetization, UI simplicity, billing, and workflow state.
- Builder Agent: implement the smallest durable change, reuse existing modules, add or update regression checks, then verify.

The user does not need to select these roles. Codex should internally route work through them before editing.

## Seven Required Components

1. Context map: keep mission, current status, known implemented features, remaining gaps, and verification commands in `.agents/project`.
2. Self-verification loop: inspect existing implementation, make scoped changes, run required checks, review the diff, and only then commit/push when requested.
3. Session persistence: after meaningful work, update status when it changes, commit/push together, and report the next task plus the task after that.
4. Failure checklist: before changing CS logic, check no guessing, high-risk escalation, owner knowledge boundaries, platform status safety, and paid-gate behavior.
5. Language independence: keep CS safety and knowledge rules industry-neutral and platform-neutral. Korean examples are fine, but rules must work for food, commerce, service, and local store categories.
6. Garbage collection: remove stale demo/free-trial copy, duplicate UI sections, unused state, dead helpers, and conflicting flows as part of each cleanup pass.
7. Scaffold-first work: create shared utilities, scripts, and regression tests before duplicating feature-specific logic.

## Verification Commitments

- Always include `npm run test:cs-guard` for CS safety, reply generation, platform inquiry, or learning changes.
- Use `npm run test:monetization` for paid adoption, billing, trial removal, or conversion-flow changes.
- Use `npm run test:workflow-safety` for AI CS workflow inbox state and card behavior.
- Use `npm run test:harness` after changing `.agents`, harness scripts, or agent operating rules.
- Run TypeScript, lint, and build before committing substantial changes.
