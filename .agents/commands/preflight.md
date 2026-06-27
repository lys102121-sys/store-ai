# Preflight Checklist

Run this mentally before non-trivial work.

1. Read `AGENTS.md`.
2. Read `.agents/project/context.md`.
3. Read `.agents/project/status.md`.
4. Read `.agents/project/moai-adk.md` when the work touches agent workflow, CS safety, platform flow, monetization, or long-term architecture.
5. If editing Next.js app/API code, read the relevant local docs under `node_modules/next/dist/docs/`.
6. Search existing implementation before editing.
   - Example: `rg -n "smartstore|coupang|missing_info|store-knowledge|correction" app scripts .agents`
7. Decide the internal route:
   - Manager: classify and detect duplicate work.
   - Expert: apply the relevant domain guardrails.
   - Builder: implement, test, and clean up.
8. Check whether stale copy, dead state, duplicate UI, or conflicting flows should be garbage-collected.
9. Decide the required verification commands before changing files.
