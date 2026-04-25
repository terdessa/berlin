# Knowledge Folder

This folder is operational memory for agents working on the project.

Use it to avoid rereading the entire project every turn. Keep entries concise, factual, and timestamp-free.

## File Map

- `progress.md`: completed work and current status
- `active-context.md`: what the current agent should know before acting
- `bugs.md`: bug list and investigation status
- `bug-locations.md`: where known bugs or fragile areas are located
- `root-causes.md`: why bugs happened or why risks exist
- `fix-log.md`: fixes applied and files changed
- `change-size.md`: approximate scope of changes, including line counts when useful
- `testing.md`: checks run, results, and gaps
- `handoff.md`: concise notes for the next agent
- `open-questions.md`: unresolved implementation or product questions
- `decisions.md`: implementation decisions and rationale
- `dependencies.md`: tools, services, APIs, and setup notes

## Rules

- Do not add timestamps.
- Prefer short factual entries.
- Link to files when useful.
- Update `active-context.md` and `handoff.md` before ending substantial work.
- Record bugs in `bugs.md`, locations in `bug-locations.md`, causes in `root-causes.md`, and fixes in `fix-log.md`.

