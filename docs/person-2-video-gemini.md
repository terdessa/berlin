# Person 2: Live Video, Camera Preview, And Gemini Detection

## Responsibility

Own the visual input path.

This workstream turns a camera feed or staged clip into a non-accusatory visual event that the rest of Sentinel can act on.

## Main Goal

Produce one reliable demo event from a camera preview or staged video, analyze it with Gemini, and send a structured `visual_event` object to the frontend and voice workstreams.

## Core Tasks

1. Set up live camera preview or staged video playback.
2. Identify the demo camera, preferably `camera-aisle-5`.
3. Create or select a staged review-worthy event, such as shelf-to-pocket movement.
4. Send frames or clips to Gemini for scene understanding.
5. Generate a concise, non-accusatory scene summary.
6. Return a confidence score.
7. Provide a clip URL, frame URL, or preview reference for the frontend.
8. Trigger the alert state in the frontend.
9. Pass the visual context to the voice/error workflow for report creation.
10. Add a fallback mock event if Gemini or live camera input is unavailable during the demo.

## Primary Output

Produce a `visual_event` object:

```json
{
  "id": "event-aisle-5",
  "cameraId": "camera-aisle-5",
  "zone": "Aisle 5",
  "summary": "Item appears to move from shelf to pocket. Human review recommended.",
  "confidence": 0.82,
  "clipUrl": "/clips/aisle-5-event.mp4",
  "frameUrl": "/frames/aisle-5-alert.jpg",
  "status": "requires_review"
}
```

## Inputs Needed

- Camera source, webcam stream, phone camera stream, or staged clip
- Gemini API access
- Camera metadata such as camera ID, zone, and label
- Safety language rules from `docs/risks-and-safety.md`

## Outputs To Person 1

- `visual_event`
- Camera preview stream or video URL
- Alert state for the relevant camera
- Visual confidence value

## Outputs To Person 3

- `visual_event.id`
- `cameraId`
- `zone`
- `summary`
- `clipUrl`
- visual confidence value

Person 3 uses these fields when creating review reports and error reports.

## Demo Acceptance Criteria

- One camera preview or staged clip is visible.
- One review-worthy event can be triggered reliably.
- Gemini produces or supports a safe scene summary.
- The output does not make identity, intent, or guilt claims.
- The frontend can display the resulting event.
- The event can be included in a review or error report.

## Safety Requirements

- No facial recognition.
- No identity tracking.
- No automated accusation.
- Describe observable behavior only.
- Use "requires review" rather than "is stealing".
- If confidence is low, mark the event as needing review instead of asserting certainty.

## Fallback Plan

If live camera or Gemini integration is unstable, use a staged clip and a precomputed `visual_event`. The demo should still show the same product loop and clearly explain where Gemini fits.

## Integration Checkpoints

1. Camera preview or staged video displays locally.
2. One event can be triggered manually.
3. Gemini returns a scene summary or the fallback summary is ready.
4. `visual_event` reaches the frontend.
5. `visual_event` is included in the review/error report flow.
