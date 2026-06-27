<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing app or API code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:store-ai-agent-harness -->
# Store AI Agent Harness

Before non-trivial work, read:

1. `.agents/project/context.md`
2. `.agents/project/status.md`
3. `.agents/project/moai-adk.md`
4. `.agents/commands/preflight.md`

Rules:

- Always check whether the requested work is already implemented before editing.
- Use `rg` over `app`, `scripts`, and `.agents` to verify existing functionality.
- Do not duplicate existing features; extend the current flow when possible.
- Internally route work through Manager, Expert, and Builder responsibilities.
- Keep the product goal in mind: a trustworthy AI CS employee that can create revenue.
- Public UX should be paid-adoption and real-platform-operation oriented, not free-trial/sample-demo oriented.
- For CS safety, platform inquiry, reply generation, or learning changes, include `npm run test:cs-guard` in validation.
- After validated work, commit and push together when the user asks to continue that workflow.
- At the end of work, report the next task and the task after that. If the user says to proceed, handle both when they can safely be done together.
<!-- END:store-ai-agent-harness -->
