# Sentinel Agent Context

## Project

Sentinel is a hackathon concept for a real-time multimodal AI system that analyzes live video and audio streams to detect high-risk retail situations and alert humans instantly.

The current high-level idea:

> Sentinel turns passive video and audio streams into real-time awareness.

## Current Direction

Sentinel is now focused on B2B retail loss-prevention awareness. The team is no longer pursuing a B2G, city, or public emergency-response framing.

The target environments are private retail sites such as supermarkets, convenience stores, shops, pharmacies, electronics stores, and other businesses where security operators already monitor many cameras.

Documentation should emphasize the product core: real-time awareness from video and audio streams, high-risk camera highlighting, evidence summaries, and human review support for retail security and store operations teams.

## Hackathon Constraints

- Team size maximum: 5
- Project must be newly created during the hackathon
- Submission requires a 2-minute demo video
- Submission requires a public GitHub repository
- Project must use at least 3 partner technologies

## Likely Track Fit

Primary fit:

- Wildcard

Possible alternate fit:

- telli and ai-coustics: Voice AI that works in the wild, if the product emphasizes robust audio understanding in noisy retail environments

## Candidate Partner Technologies

- Google DeepMind: multimodal reasoning over image, video, and audio context
- Gradium or ai-coustics: real-time voice/audio layer
- Entire: human-in-the-loop collaboration and store review workflows
- Lovable: rapid UI prototyping
- Tavily: contextual search for store procedures, loss-prevention policies, or response guidance
- Pioneer: possible fine-tuning or evaluation layer if a small model replaces part of the pipeline

## Product Principles

- Human-in-the-loop by default
- No facial recognition
- No identity tracking
- No automated accusation, detention, punishment, or enforcement
- Alerts should be explainable and reviewable
- The demo should feel like a real operational product, not just a model output

## Core Value Proposition

Sentinel reduces the latency between a possible retail loss-prevention event happening and the security operator noticing it.

The product should help a human monitoring many cameras notice high-risk situations quickly, understand the observable evidence quickly, and decide whether any store action is appropriate.

## Alert Threshold

Sentinel should interrupt humans when it detects observable high-risk retail signals that may deserve human review.

Examples include a person taking an item from a shelf and placing it into a pocket or bag, concealment-like hand motion, checkout bypass, self-checkout mismatch, repeated shelf-to-bag movement, unusual movement near high-value shelves, or other clear visual/audio evidence that a security operator should review.

Sentinel should avoid claiming theft, intent, guilt, or identity. It should surface observable evidence and ask for human review.

## Primary User

The exact user title remains flexible. Sentinel should be designed for a retail security operator or store operations human responsible for noticing, assessing, and responding to high-risk situations across many live feeds.

Depending on the site, this person could be a security operator, loss-prevention associate, store manager, retail operations manager, security supervisor, or business owner.

## Core Demo Surface

The most important product surface is a live retail camera operations dashboard:

- store map or site layout of camera locations
- active camera markers
- red pulsing alert marker when a high-risk retail event is detected
- background multimodal monitoring
- alert card with short summary, confidence, severity, and source feed
- replay clip or evidence panel
- actions such as acknowledge, watch live, send floor associate, ignore, or create incident

The reference UI uses a dark live camera map pattern with active camera pins and one red alert pin. For Sentinel, this should be adapted into a supermarket or shop floor plan with aisles, checkout areas, exits, and high-value sections.

## Prototype Strategy

The demo should combine:

- around 10 previewable camera feeds
- one real mobile phone livestream
- AI analysis on the livestream
- a staged retail loss-prevention review event in the livestream
- map marker alert state when the event is detected

Most non-demo camera feeds can be endless loop videos that represent store camera feeds. The AI engine should only run on the mobile phone livestream for the hackathon demo.

Clicking a normal camera opens an almost fullscreen camera view with live video, rewind, return-to-live, and camera metadata.

The normal camera preview should include the Sentinel shell, camera name, live status, large video area, playback controls, return-to-live control, fullscreen control, and a right-side details panel with camera ID, location, coordinates, status, resolution, camera type, feed type, and an add note action.

Clicking an alert camera opens the same view in a red alert state with a split view for live video and the short evidence clip that triggered the alert, plus an AI summary and response context. Alert language must describe observable behavior, not accuse anyone of stealing.

## Open Questions

See `clarifying-questions.md`.

## Decisions

See `decision-log.md`.
