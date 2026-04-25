# Person 1: Frontend And Lovable

## Responsibility

Own the full visible Sentinel demo experience.

The frontend should make the project understandable even when backend integrations are still mocked. It is the stage where the camera event, voice interaction, confidence values, and review/error report come together.

## Main Goal

Build a polished dashboard that can run from mock data first, then accept real outputs from the video/Gemini and voice/error-logging workstreams.

## Required Screens

- Camera grid or shop floor plan
- Highlighted alert camera
- Live camera preview or evidence video panel
- Earpiece alert transcript
- Raw guard transcript
- Enhanced guard transcript
- Command interpretation and confidence
- Review report panel
- Error report panel

## Core Tasks

1. Create the main dashboard layout.
2. Add mock camera feeds, including one alerting camera.
3. Show the staged alert state for Aisle 5.
4. Display the non-accusatory assistant alert text.
5. Display raw vs enhanced transcript comparison.
6. Display command confidence clearly.
7. Open or focus the evidence video when the command is `open_camera`.
8. Show a review report when the command succeeds.
9. Show an error report when confidence is too low.
10. Keep all UI language human-review oriented and non-accusatory.

## Inputs From Other Workstreams

### From Person 2

Receives a `visual_event` object:

```json
{
  "id": "event-aisle-5",
  "cameraId": "camera-aisle-5",
  "zone": "Aisle 5",
  "summary": "Item appears to move from shelf to pocket. Human review recommended.",
  "confidence": 0.82,
  "clipUrl": "/clips/aisle-5-event.mp4"
}
```

### From Person 3

Receives a `voice_command` or `error_report` object:

```json
{
  "id": "command-open-aisle-5",
  "rawTranscript": "open all five",
  "enhancedTranscript": "open aisle five",
  "interpretedCommand": "open_camera",
  "targetCameraId": "camera-aisle-5",
  "confidence": 0.91,
  "actionStatus": "ready"
}
```

## Outputs To Other Workstreams

- UI event when a camera is selected
- UI event when a report is opened
- UI confirmation that an action was displayed
- Screens or demo recording snippets for the final submission

## Demo Acceptance Criteria

- The dashboard works with mock data without any live integrations.
- A camera alert can be shown immediately.
- The evidence video panel opens from a successful voice command.
- A low-confidence command produces an error report instead of an action.
- The interface visibly supports the track metric: raw vs enhanced transcript, command confidence, or task completion.

## Safety Requirements

- Do not use words like "thief", "criminal", or "stealing".
- Use "requires review", "appears to", and "human review recommended".
- Always show confidence for visual and voice outputs.
- Do not imply automated enforcement.

## Integration Checkpoints

1. Frontend runs with local mock JSON.
2. Frontend accepts one real `visual_event`.
3. Frontend accepts one real `voice_command`.
4. Frontend shows one successful review report.
5. Frontend shows one error report for unclear voice input.
