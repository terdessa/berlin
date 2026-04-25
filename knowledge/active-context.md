# Active Context

Sentinel is now a **voice-first retail security copilot** for the **telli + ai-coustics** track.

Core loop:

1. CCTV/live camera detects review-worthy retail behavior.
2. Sentinel speaks an alert to a guard through an earpiece.
3. Guard responds by voice in noisy store conditions.
4. ai-coustics enhances audio.
5. Voice layer interprets command.
6. Sentinel opens video, routes action, or creates an error report.

Keep the product non-accusatory:

- no facial recognition
- no identity tracking
- no automated theft claim
- no automated enforcement
- human review before action

Next useful task:

Define schemas for visual event, voice command, action result, and error report.

Side challenge focus:

- Entire is the main side-challenge implementation target.
- Aikido is worth doing if setup is quick.

Voice runtime: telli (track host). The audio path is mic → ai-coustics → telli, kept deliberately minimal so ai-coustics is the single variable in the before/after metric.
