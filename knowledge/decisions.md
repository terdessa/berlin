# Decisions

## Documentation And Memory Structure

Decision:

Use `docs/` for product and concept documentation. Use `knowledge/` for operational project memory such as progress, bugs, fixes, testing, and handoff notes.

Rationale:

This lets future agents quickly understand both the product direction and the current work state without rereading every file.

## B2B Retail Loss-Prevention Framing

Decision:

Position Sentinel for B2B retail loss-prevention awareness.

Rationale:

Judges advised that a private solution is stronger than a B2G approach. Retail loss prevention gives Sentinel clearer buyers, a stronger ROI story, and a more immediately understandable demo. The product must route attention to a human reviewer without accusing anyone of theft.

## Demo Feed Strategy

Decision:

Use many previewable retail feeds for product scale, but run AI analysis only on one mobile phone livestream.

Rationale:

This keeps the demo reliable while proving the core intelligent alert path.

## Alert Detail View

Decision:

Use the same fullscreen camera preview for normal and alert cameras. Alert cameras add a red frame, evidence clip, AI summary of observable behavior, store location context, and human review actions.

Rationale:

This keeps the interface consistent and makes the alert state feel like a natural extension of the normal camera view.
