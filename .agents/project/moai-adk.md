# MoAI-ADK Adaptation For Store AI

This project does not copy MoAI-ADK as a dependency. It applies the operating principles as a harness for building a trustworthy AI CS employee.

## Role Routing

### Manager Agent

Purpose: decide what kind of work this is before editing.

Checklist:

- Is this already implemented?
- Is the task about CS safety, learning, platform integration, monetization, UI, billing, or internal tooling?
- Could the change affect revenue, customer trust, high-risk replies, or platform posting?
- Which tests must run?

### Expert Agent

Purpose: apply domain rules.

Domain experts:

- CS Safety Expert: no guessing, high-risk escalation, exact knowledge boundaries.
- Store Knowledge Expert: missing info, owner corrections, reusable facts, stale/duplicate knowledge.
- Platform Expert: source platform, external id, platform status, import/reply lifecycle.
- Monetization Expert: paid adoption, entitlement, admin follow-up, revenue value.
- UX Expert: simple owner journey, low copy density, clear next action.

### Builder Agent

Purpose: implement the smallest durable change.

Checklist:

- Reuse existing modules and local patterns.
- Prefer shared utilities over duplicate platform-specific logic.
- Add or update regression tests.
- Remove stale state/copy that conflicts with the new flow.
- Run verification before commit/push.

## Seven Components

### 1. Context Map

Use `.agents/project/context.md` and `.agents/project/status.md` as the durable project memory.

### 2. Self-Verification Loop

For every substantial change:

1. Search existing code.
2. Identify affected flows.
3. Implement narrowly.
4. Run required tests.
5. Review diff.
6. Commit and push when requested.

### 3. Session Persistence

Keep status current, commit/push together after validated work, and always report next and next-next tasks.

### 4. Failure Checklist

Before finalizing CS logic, confirm:

- No invented price, stock, refund, shipping, schedule, health, legal, or claim facts.
- High-risk content is never auto-completed.
- Missing information creates a path for owner learning.
- Platform posting failure keeps status safe.
- Paid gates do not leak production value to unpaid users.

### 5. Language Independence

Rules should not depend on one business category. Keyword examples may be Korean, but the logic must support restaurant, cafe, commerce, beauty, local service, and other owners.

### 6. Garbage Collection

Remove duplicate cards, stale demo/free-trial copy, unused state, unused helpers, and conflicting UI paths during cleanup.

### 7. Scaffold First

When a pattern repeats, create a shared utility, shared test fixture, or shared regression script before adding the next platform-specific version.

## Default Routing Table

| Request signal | Manager route | Required checks |
| --- | --- | --- |
| CS reply, risk, missing info, owner learning | CS Safety + Store Knowledge + Builder | `test:cs-guard`, learning/store knowledge tests when touched |
| Platform import/reply/status | Platform + CS Safety + Builder | `test:cs-guard`, workflow safety |
| Payment, trial, adoption, admin sales | Monetization + UX + Builder | `test:monetization` |
| AI CS inbox/card/status UI | UX + Platform + Builder | `test:workflow-safety` |
| Agent rules or workflow docs | Manager + Builder | `test:harness` |
