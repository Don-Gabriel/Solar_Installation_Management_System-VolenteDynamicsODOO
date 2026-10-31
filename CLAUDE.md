# Shared implementation context

Follow [AGENTS.md](AGENTS.md), [the build plan](docs/BUILD_PLAN.md), [technology decisions](docs/TECH_STACK.md) and [skill routing](docs/SKILLS.md).

This is the same repository used by Codex. Preserve uncommitted work; inspect the current state before editing. Use the existing module boundaries and shared contracts. Do not independently change the stack, business invariants or desktop/mobile acceptance criteria.

Local skill installations are documented by pinned source revision in `docs/skill-sources.json`. Existing Claude frontend-design and mobile/accessibility skills remain available. Tool availability must be checked separately from skill presence.
