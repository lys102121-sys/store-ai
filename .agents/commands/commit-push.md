# Commit And Push Policy

User-approved workflow:

1. Finish the scoped work.
2. Run the required verification.
3. Check `git status`.
4. Stage changes.
5. Commit with a message that matches the actual work.
6. Push immediately after the commit.
7. Report what changed, what was verified, and the next task plus the task after that.

Example:

```bash
git add .
git commit -m "Add agent harness checklist"
git push
```

Rules:

- Do not commit unvalidated work unless the user explicitly requests it.
- Do not revert user changes.
- Do not use destructive git commands unless the user explicitly asks.
- Commit messages must be specific to the work, not reused placeholders.
