# Demo Plan

## Demo Goal

Show that Sentinel can reduce the time between a possible retail loss-prevention event happening and a human security operator noticing it by turning live or simulated shop camera feeds into clear, evidence-based review alerts.

## Core Demo Flow

1. Operator sees a supermarket or shop floor plan with multiple live camera locations.
2. Around 10 previewable camera feeds create the feeling of broad coverage.
3. One camera feed is a real mobile phone livestream.
4. Sentinel monitors the livestream in the background.
5. A staged retail review event occurs in the phone stream, such as an item taken from a shelf and placed into a pocket or bag.
6. Sentinel detects the observable sequence.
7. The affected camera marker pulses red and receives an alert label.
8. The operator clicks the alert marker.
9. An almost fullscreen camera view opens with a red alert frame.
10. The operator sees the live feed, the evidence clip, the AI summary, and response context.
11. Operator chooses an action:
   - acknowledge
   - watch live
   - send floor associate
   - ignore
   - create incident

## Camera View

When a user clicks any normal camera, Sentinel should open an almost fullscreen popup with:

- Sentinel branded shell over the map
- camera name and live status
- camera live view
- playback controls
- pause control
- short rewind control
- return-to-live control
- fullscreen control
- right-side camera metadata
- location
- coordinates
- camera ID
- status
- resolution
- camera type
- feed type
- add note action

## Alert View

When the selected camera has an alert, the same camera view should open in an alert state:

- red frame
- live camera view
- short evidence clip showing the fragment that triggered the alert
- short AI summary
- event moment
- aisle, checkout, exit, or shelf location
- relevant store response option or responsible staff member
- action buttons

The alert view should help the operator answer two questions quickly:

- what is happening now
- why did Sentinel interrupt me

## Demo Assets To Define

- target retail environment
- review scenario
- number of feeds or camera markers
- shop floor plan or supermarket layout visual
- alert types
- evidence/replay format
- review or response destination
- partner technologies visibly used in the flow
- looped local videos
- mobile phone streaming setup
- staged trigger event

## Feed Strategy

Most camera markers can be backed by endless loop videos that represent store camera feeds.

Only the mobile phone livestream needs to be analyzed by the AI engine for the demo.

## Reference UI Pattern

The reference images show a dark Sentinel camera monitoring interface:

- neutral camera pins for active cameras
- red pulsing camera marker for the triggered alert
- visible "ALERT" label under the triggered camera
- online camera count
- active versus alert legend
- fullscreen camera preview modal
- large live video area
- right-side camera details panel
- playback and return-to-live controls
- add note action

This pattern should be adapted to a retail site, such as a supermarket map, shop floor plan, aisle layout, checkout area, exit view, or high-value shelf section.

## Open Demo Questions

- Which non-demo feeds should use looped local videos?
- What is the single incident that best sells the product?
- What should happen after a human review action?
