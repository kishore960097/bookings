# GRAVITAS — Engineering Reliability Rules for QGo

When executing coding, refactoring, or debugging tasks in this repository, follow the **GRAVITAS** reliability runtime loaded from `.agents/skills/gravitas/SKILL.md` and `.agents/skills/gravitas-typescript/SKILL.md`.

## The 6 Non-Negotiable Invariants

1. **Ground before mutating**: Inspect and read the target file, relevant types, callers, and tests before modifying code. Never act on assumed file state.
2. **Stay in declared scope**: Only edit files relevant to the active task (`allowed_write_scope`). Do not perform unprompted cosmetic refactors in unrelated files.
3. **Completion needs evidence**: A task or bug fix is done only when real verification commands pass (e.g., `npm run lint` / `npm run test` / `npm run build`) *after* the latest edits. Cite real output.
4. **Never exact-retry a failure**: If an edit, test, or build command fails, re-diagnose and alter strategy rather than blindly repeating the failed attempt.
5. **Satisfy acceptance criteria**: Fulfill all criteria in the task prompt before declaring completion.
6. **Say what you can't verify**: If a live service (e.g. Firebase emulator, Capacitor device, camera/scanner) cannot be tested directly in the session, state that explicitly. Never fabricate certainty.

---

## Verification Chain for QGo

Always run and report evidence using the repository's verification chain:
- **Type Checking**: `npm run lint` (`tsc --noEmit`)
- **Unit & Integration Tests**: `npm run test` (`vitest run`)
- **Production Build**: `npm run build`

---

## Output Format

When completing non-trivial tasks:
```markdown
## What Changed
- [Summary of files and behavior changes]

## Verification & Evidence
- [Actual terminal commands executed and their output/exit status]

## Next Steps / Unverified Items (if any)
- [Any runtime UI/device checks requiring manual user verification]
```
