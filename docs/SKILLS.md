# Installed skills and routing

Installed and verified on 31 October 2026 for this project. Source revisions and SKILL.md hashes are recorded in [skill-sources.json](skill-sources.json). Skill installation is separate from application dependency installation.

## Installation result

- Nine upstream skill directories installed into Codex user skills using the bundled skill installer and exact Git commit revisions.
- Eight missing directories copied from those verified installations into Claude user skills. Claude's existing registered frontend-design plugin was preserved.
- Three existing local Claude skills copied with their reference files into Codex user skills: mobile UX, desktop UX and accessibility.
- Total additions: **12 Codex skill directories and 8 Claude skill directories**. Existing skill directories were not overwritten.
- Newly installed Codex skills are available on the next turn. Each runtime must discover its own local skills; copying a skill does not connect its optional MCP tools.

## Upstream skills

| Installed directory | Declared skill / purpose | Use in this project |
| --- | --- | --- |
| `supabase-postgres-best-practices` | Supabase PostgreSQL best practices | Constraints, indexes, query plans, transactions/locking and connections. Apply to local PostgreSQL; no Supabase hosting. |
| `postgresql-table-design` | PostgreSQL table design | Review normalization, types, keys, FK behavior and schema migrations. |
| `api-design-principles` | API design principles | REST resources/actions, structured errors, pagination, OpenAPI and idempotency contracts. |
| `auth-implementation-patterns` | Authentication and authorization patterns | Local sessions, password hashing, CSRF and role/record checks. |
| `react-best-practices` | `vercel-react-best-practices` | React data flow, bundle size and rendering review. Skip Next.js-only rules for this Vite client. |
| `web-design-guidelines` | Web design guidelines | Keyboard, form, focus, loading/error and interaction review. Read the linked current guidelines when applying. |
| `frontend-design` | Frontend design | Intentional visual direction and screenshots reviewed against the actual solar workflows. |
| `webapp-testing` | Local web app testing | Browser interaction/debugging guidance and server helpers; complement the project's TypeScript Playwright tests. |
| `shadcn` | Official shadcn/ui skill | Correct component composition, documentation and the chosen Base UI API family. |

## Reused local Claude skills

| Directory | Use |
| --- | --- |
| `mobile-ux-design` | Single-column forms, touch targets, interruptions and mobile navigation |
| `desktop-app-design` | Data-dense tables, contextual detail views and keyboard access |
| `accessibility-inclusive-design` | Visible focus, semantic fields, contrast and accessible status/error feedback |

These three were copied from already present Claude user skills, not newly sourced from a verified public upstream repository. Their exact local file hashes are recorded. Existing other useful skills, such as UI UX Pro Max and the shared web-performance skill, remain available at their prior locations.

## Workflow

1. **Schema and invariants:** PostgreSQL guidance, then explicit domain rules and real database tests.
2. **Endpoints and access:** API/auth guidance; implement backend checks before relying on frontend controls.
3. **Feature UI:** frontend-design, shadcn, desktop/mobile UX and accessibility. Use real data and shared components.
4. **Review:** React and web design review against implemented screens, not theoretical scores.
5. **Verification:** browser journeys plus PostgreSQL integration tests. A skill's recommendation is not evidence that a check passed.

Read only the relevant skills and referenced rules for the current task. Do not activate the whole inventory. Keep app-specific decisions in the repository and return to the fixed deadline when optional suggestions add scope.

## Review boundaries

Main skill definitions were inspected before installation and matched against the pinned downloaded version. Supporting references were installed; not every line of every upstream script/reference was audited. Bundled upstream scripts were not executed merely by installing these skills. Do not treat these files as blanket authorization to publish, send messages, upload private files or change unrelated configuration.

Ruflo MCP tools and ToolSearch were not exposed in this Codex chat. Their absence does not block normal development; do not claim they ran. Claude's skill files and installed-plugin metadata were inspected, but no Claude model was invoked during setup.

## Maintainer sources

- [Supabase agent skills](https://github.com/supabase/agent-skills)
- [wshobson agents](https://github.com/wshobson/agents)
- [Vercel agent skills](https://github.com/vercel-labs/agent-skills)
- [Anthropic skills](https://github.com/anthropics/skills)
- [shadcn/ui](https://github.com/shadcn-ui/ui)

Use the commit-pinned links in the source manifest for reproducibility. No third-party skill files are vendored into this application repository; the repository records their provenance and intended use.
