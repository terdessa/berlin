# Sentinel Documentation

This folder is the working documentation system for the Sentinel hackathon idea.

The goal is to make the concept clear enough that any teammate or AI agent can quickly understand the product direction, demo plan, architecture, risks, and unanswered questions.

## File Map

- `agent-context.md`: canonical context for Claude, Codex, Cursor, and other agents
- `claude.md`: Claude-specific working instructions
- `codex.md`: Codex-specific working instructions
- `cursor.md`: Cursor-specific working instructions
- `idea-brief.md`: concise explanation of the product idea
- `clarifying-questions.md`: question bank and collected answers
- `decision-log.md`: decisions made and why
- `assumptions.md`: assumptions that need validation
- `demo-plan.md`: hackathon demo narrative and screen flow
- `architecture.md`: system architecture and data flow
- `partner-tech.md`: hackathon partner technologies and how Sentinel may use them
- `pitch.md`: one-liners, short pitch, and presentation structure
- `risks-and-safety.md`: privacy, ethics, security, and product risk notes
- `research-notes.md`: supporting notes, references, and raw observations

## Documentation Rules

- Do not add timestamps.
- Prefer clear, reusable context over chat-like notes.
- Mark uncertain claims as assumptions.
- Keep decisions separate from open questions.
- Update `agent-context.md` when an answer changes the core project direction.

Operational progress, bugs, fixes, testing notes, and handoff context belong in `../knowledge/`.

## Current Project Snapshot

Sentinel is now a B2B retail loss-prevention awareness concept. The team is no longer pursuing a B2G city or public emergency-response framing.

The current demo direction is:

- supermarket or shop floor plan with camera markers
- around 10 previewable camera feeds
- most feeds backed by endless loop videos representing store cameras
- one real mobile phone livestream
- AI analysis only on the phone livestream
- red pulsing marker when the phone stream triggers an alert
- fullscreen camera preview modal for normal feeds
- red-framed alert modal with live view, evidence clip, AI summary, location context, and human review actions
