# Active Context

Sentinel is a hackathon concept for real-time multimodal retail loss-prevention awareness across live shop camera streams.

The project is currently in concept clarification and documentation setup.

Canonical product context lives in `docs/agent-context.md`.

Operational memory lives in this `knowledge/` folder.

Current direction:

The team is moving to a B2B retail loss-prevention awareness framing. Do not pursue a B2G, city, public surveillance, public emergency-response, or automated theft accusation framing.

Primary user:

The user should remain role-based rather than title-based: a retail security or store operations human responsible for noticing, assessing, and responding to high-risk situations across many live feeds.

Core value:

Sentinel reduces possible loss-event-to-review latency by ensuring review-worthy camera moments are noticed quickly and routed to the right human faster.

Alert threshold:

Sentinel should interrupt a human when observable visual evidence suggests a high-risk retail review moment, such as an item taken from a shelf and placed into a pocket or bag, checkout bypass, self-checkout mismatch, repeated shelf-to-bag movement, or unusual movement near high-value shelves.

Reference UI:

The reference images show a dark Sentinel interface with a camera map, active camera pins, a red pulsing alert marker, and a fullscreen camera preview modal. The normal camera preview includes a large live feed, playback controls, return-to-live control, camera details, and an add note action. This should be adapted to a supermarket or shop floor plan with aisles, checkout areas, exits, and high-value shelves.

Prototype strategy:

Show around 10 previewable store camera feeds, plus one real mobile phone livestream. Most feeds can be endless loop videos representing live retail cameras. Only the mobile phone livestream needs AI analysis for the demo. A triggered camera opens an almost fullscreen red-framed alert view with live video, short evidence clip, camera metadata, AI summary of observable behavior, event moment, store location, and human review actions.

Current discovery question:

When the AI analyzes the mobile phone livestream, what exact output should it produce for the rest of the system?
