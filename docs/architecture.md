# Architecture

## Working Architecture

Sentinel can be described as a pipeline:

1. Ingest live video and audio streams.
2. Segment streams into short analysis windows.
3. Run multimodal analysis on each window.
4. Classify relevance, severity, and confidence.
5. Create an alert when an event appears to require human attention.
6. Store evidence and source references.
7. Present the alert in an operator dashboard.
8. Capture human feedback and action.

## Components

### Input Layer

- camera feeds
- microphone or environmental audio
- optional prerecorded clips for demo reliability
- endless loop video feeds for broad coverage
- store camera looped feeds for demo reliability
- one real mobile phone livestream for the live AI trigger path

### Analysis Layer

- visual event understanding
- audio event understanding
- multimodal summary generation
- confidence and severity scoring

For the hackathon demo, the analysis layer only needs to run against the mobile phone livestream. Other camera feeds can remain preview-only.

### Alert Layer

- event summary
- evidence clip
- source feed
- confidence
- severity
- recommended human review step
- event moment
- relevant store response option

Alerts should be based on observable retail evidence such as an item taken from a shelf and placed into a pocket or bag, concealment-like hand movement, checkout bypass, self-checkout mismatch, repeated shelf-to-bag movement, unusual movement near high-value shelves, or other high-risk scene changes that deserve human review.

### Human Review Layer

- acknowledge
- watch live
- send floor associate
- ignore
- add note
- create incident record

### Spatial Awareness Layer

- store map or floor plan
- camera locations
- camera status
- alert marker state
- selected camera or incident panel

### Camera Detail Layer

- almost fullscreen camera popup
- Sentinel branded shell
- camera name and live status
- live view
- playback controls
- short rewind control
- return-to-live control
- fullscreen control
- camera metadata
- add note action
- alert state with red frame
- split view for live feed and triggering evidence clip

### Knowledge Layer

Potential future layer for store policies, loss-prevention procedures, review rules, camera-zone context, and location-specific retail rules.

## Open Technical Questions

- Which model handles visual understanding?
- Which tool handles audio enhancement or voice/audio understanding?
- What parts are real-time versus simulated for the demo?
- How are alerts stored?
- How does human feedback improve future alerts?
- What map, floor plan, or spatial layout should represent monitored cameras?
- What exact event schema should the AI return to the UI?
