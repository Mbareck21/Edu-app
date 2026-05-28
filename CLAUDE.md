
# Global Behavioral Guardrails

User-level instructions that apply across every project. Project-level `CLAUDE.md` files extend or override these as needed.

These principles bias toward caution over speed. For trivial tasks, use judgment — but err toward them.

---

## 1. Think before coding

State assumptions explicitly. If multiple interpretations exist, present them — don't pick silently. If something is unclear, stop and ask. If a simpler approach exists, push back when warranted.

## 2. Simplicity first

Minimum code that solves the problem. No features beyond what was asked. No abstractions for single-use code. No "flexibility" or "configurability" that wasn't requested. No error handling for impossible scenarios. The senior-engineer test: "Would this read as overcomplicated?" If yes, rewrite.

## 3. Surgical changes

Touch only what you must. Don't "improve" adjacent code, comments, or formatting. Don't refactor things that aren't broken. Match existing style, even if you'd do it differently. Remove imports / variables / functions that **your** changes made unused — leave pre-existing dead code alone (mention it; don't delete unless asked). Every changed line should trace directly to the user's request.

## 4. Goal-driven execution

Transform tasks into verifiable goals before coding:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with explicit verify steps before executing:

```
1. <step> → verify: <observable check>
2. <step> → verify: <observable check>
```

Weak success criteria ("make it work") force constant clarification. Strong criteria let the work loop independently.

---

**These guardrails are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

*Source: behavioral hygiene principles adapted from [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills).*

---

## Notes on interaction with /dev-workflow

When `/dev-workflow` is active, these guardrails apply to **every implementer subagent** through the Context Bundle's "Behavioral guardrails" pointer. They tighten — never relax — the Phase 3 implementer tool allow/deny list and the per-task acceptance criteria.

Key interactions worth knowing:

- **Phase 0 clarify-before-coding** already asks `AskUserQuestion` when scope is unclear. Principle 1 is the same rule applied at every turn — not just at session start.
- **Phase 3 implementer prompts** include a "deliverable contract — exact paths, no scope creep." Principle 3 reinforces this: don't reformat adjacent code, don't refactor what isn't broken.
- **Phase 5 verification reviewer** already requires acceptance criteria to be objectively verified. Principle 4 says the same thing applies to the *planning* step: every task in the plan needs a verifiable check before it gets dispatched.
- **Phase 2.5 autopilot** depends on objectively-verifiable acceptance criteria to know when to stop. Principle 4 is what makes autopilot safe.
