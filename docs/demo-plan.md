# Sentinel Demo Plan

## Goal

Prove Sentinel is a real-time voice interface that works in noisy retail environments.

## Demo Flow

1. Show a supermarket dashboard with many camera feeds.
2. One analyzed feed shows a staged review-worthy event, such as shelf-to-pocket movement.
3. Sentinel flags the camera.
4. Sentinel speaks an earpiece alert:
   - "Aisle 5 requires review. Item appears to move from shelf to pocket."
5. Guard responds over noisy store audio:
   - "Open aisle five."
6. ai-coustics enhances the audio.
7. Voice layer interprets the command.
8. Sentinel opens the relevant evidence video.
9. Guard says:
   - "Send floor associate and create report."
10. Sentinel creates a review record.
11. If voice understanding fails, Sentinel creates an error report instead of taking a risky action.

## Required Screens

- Camera grid or shop floor plan
- Highlighted alert camera
- Video/evidence panel
- Earpiece alert transcript
- Raw vs. enhanced guard transcript
- Command confidence
- Review/error report panel

## Error Report Contents

- triggering video clip
- camera ID and store zone
- assistant message
- raw audio
- enhanced audio
- transcript attempt
- interpreted command
- expected command candidates
- confidence score
- action taken or failure reason
- final human correction

## Track Metric

Pick one:

- command recognition accuracy with vs. without ai-coustics
- transcript confidence before/after enhancement
- task completion rate under noisy supermarket audio
- alert-to-video-open time using voice

## Demo Rule

Keep language non-accusatory. The system flags review-worthy observable behavior; it does not decide that theft happened.
