<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:store-ai-agent-harness -->
# Store AI Agent Harness

Before non-trivial work, read:

1. `.agents/project/context.md`
2. `.agents/project/status.md`
3. `.agents/commands/preflight.md`

Rules:

- Always check whether the requested work is already implemented before editing.
- 중복 구현을 막기 위해 작업 전에 이미 진행된 기능인지 반드시 확인한다.
- Use `rg` over `app`, `scripts`, and `.agents` to verify existing functionality.
- Do not duplicate existing features; extend the current flow when possible.
- Keep the product goal in mind: a trustworthy AI CS employee that can create revenue.
- For CS safety, platform inquiry, reply generation, or learning changes, include `npm run test:cs-guard` in validation.
- After validated work, commit and push together.
- 검증이 끝난 작업은 커밋 후 바로 푸시한다.
- At the end of work, report the next task and the task after that. If the user says to proceed, handle both when they can safely be done together.
<!-- END:store-ai-agent-harness -->
