# Decision Log

Use this file for product, technical, pitch, and demo decisions.

## Decisions

### Commit To B2B Retail Loss Prevention

Decision:

Position Sentinel as a B2B retail loss-prevention awareness product.

Rationale:

Judges advised that a private solution is stronger than a B2G approach. Retailers give Sentinel a clear buyer, a clear ROI story around shrinkage and camera-monitoring overload, and a demo that is easy to understand. The product must remain human-reviewed and avoid accusing anyone of theft.

### Define The User By Responsibility

Decision:

Describe the primary user as the person responsible for noticing, assessing, and responding to high-risk retail moments across multiple live feeds.

Rationale:

This role can map to a security operator, loss-prevention associate, store manager, retail operations manager, security supervisor, or business owner without forcing a single job title too early.

### Core Value Is Event-To-Review Latency

Decision:

Frame Sentinel around reducing the delay between an observable high-risk retail event happening and the right human reviewing it.

Rationale:

This works especially well in retail because one operator may need to monitor many cameras at once. It is more specific than generic AI monitoring and easier to defend in a hackathon pitch.

### Use A Spatial Camera Interface

Decision:

Use a shop floor plan or store layout with camera markers as the primary interface.

Rationale:

The visual pattern makes the product understandable quickly: many monitored cameras, one high-risk review moment, and a clear place for the operator to inspect evidence.

### Use One AI-Analyzed Livestream

Decision:

For the hackathon demo, run AI analysis only on a real mobile phone livestream. Use endless loop videos representing store cameras for the other previewable feeds.

Rationale:

This creates the feeling of a real monitoring network while keeping the hard real-time AI integration focused, controllable, and reliable.

### Documentation Architecture

Decision:

Use `docs/agent-context.md` as the canonical source of truth, with agent-specific bridge files for Claude, Codex, and Cursor.

Rationale:

This keeps the project understandable across different AI assistants while avoiding duplicated or conflicting context.
