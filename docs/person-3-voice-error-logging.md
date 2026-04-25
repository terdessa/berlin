# Person 3: Voice Chat Loop And Error Logging

## Responsibility

Own the audio, command interpretation, and report workflow.

This workstream proves the core track claim: Sentinel can understand a guard in noisy retail conditions and preserve enough context when it fails.

## Main Goal

Build the voice loop using Gradium and ai-coustics, interpret guard commands, and create review or error records with enough context for human review.

## Core Tasks

1. Play or speak the earpiece alert from a visual event.
2. Capture the guard's spoken command.
3. Run noisy audio through ai-coustics enhancement.
4. Use Gradium for the realtime voice interaction path.
5. Produce raw and enhanced transcript attempts.
6. Interpret the command into a small command set.
7. Return command confidence.
8. Route successful commands to the frontend.
9. Create a review report for successful action flows.
10. Create an error report when voice understanding is unclear.
11. Integrate Entire for review tasks, action tracking, incident records, or error reports.
12. Provide the audio metric for the final demo.

## Supported Commands

- `open_camera`
- `watch_live`
- `replay_last_10_seconds`
- `send_floor_associate`
- `mark_false_alarm`
- `create_report`

## Primary Output: Voice Command

```json
{
  "id": "command-open-aisle-5",
  "visualEventId": "event-aisle-5",
  "rawTranscript": "open all five",
  "enhancedTranscript": "open aisle five",
  "interpretedCommand": "open_camera",
  "targetCameraId": "camera-aisle-5",
  "confidence": 0.91,
  "actionStatus": "ready"
}
```

## Primary Output: Error Report

```json
{
  "id": "error-voice-unclear-aisle-5",
  "visualEventId": "event-aisle-5",
  "cameraId": "camera-aisle-5",
  "zone": "Aisle 5",
  "assistantMessage": "Aisle 5 requires review. Item appears to move from shelf to pocket. Human review recommended.",
  "rawTranscript": "send floor something report",
  "enhancedTranscript": "send floor associate and create report",
  "interpretedCommand": "send_floor_associate",
  "expectedCommandCandidates": [
    "send_floor_associate",
    "create_report"
  ],
  "confidence": 0.54,
  "failureReason": "voice_command_unclear",
  "actionTaken": "none",
  "finalHumanCorrection": null
}
```

## Inputs From Person 2

- `visual_event.id`
- `cameraId`
- `zone`
- visual summary
- clip URL or frame URL
- visual confidence value

## Outputs To Person 1

- Earpiece alert text
- Raw transcript
- Enhanced transcript
- Interpreted command
- Command confidence
- Action status
- Review report
- Error report

## Entire Integration

Use Entire for at least one of:

- review task creation
- action tracking
- false-positive marking
- incident record creation
- voice error report creation

Minimum useful Entire payload:

```json
{
  "title": "Aisle 5 camera requires review",
  "cameraId": "camera-aisle-5",
  "zone": "Aisle 5",
  "visualSummary": "Item appears to move from shelf to pocket. Human review recommended.",
  "enhancedTranscript": "open aisle five",
  "interpretedCommand": "open_camera",
  "confidence": 0.91,
  "actionTaken": "opened_evidence_video"
}
```

## Audio Metric

Own one simple track metric:

- transcript confidence before and after ai-coustics
- command recognition before and after ai-coustics
- task completion under noisy supermarket audio

The metric should be visible in the frontend or easy to mention in the demo video.

## Safety Requirements

- If voice confidence is low, ask for clarification or create an error report.
- Do not trigger irreversible actions from low-confidence commands.
- Keep all report language non-accusatory.
- Error reports debug the system, not the guard.

## Integration Checkpoints

1. One earpiece alert can be generated from a visual event.
2. One noisy command can be captured or replayed.
3. Raw and enhanced transcripts are available.
4. One successful command opens the right camera in the frontend.
5. One low-confidence command creates an error report.
6. One review or error record is sent to Entire.
