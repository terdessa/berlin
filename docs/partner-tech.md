# Track And Partner Plan

## Primary Track

**telli + ai-coustics: Voice AI that works in the wild**

Sentinel fits if the demo centers on noisy voice interaction:

- assistant speaks alert to guard
- guard responds in noisy supermarket audio
- ai-coustics enhances audio
- command is understood or error report is created
- demo includes an audio metric

## Required Partner Stack

Use at least 3 partner technologies.

Recommended stack:

- **ai-coustics:** noisy audio enhancement for guard commands (the track differentiator)
- **telli:** realtime voice interaction runtime (track host)
- **Google DeepMind:** video/scene understanding
- **Entire:** human review, action tracking, incident/error workflow

Why no third-party voice runtime on top of telli: keeping the audio path as
mic → ai-coustics → telli isolates ai-coustics as the single variable in the
before/after metric. Adding another realtime voice layer would muddy what the
judges are looking for on this track.

Ask organizers whether ai-coustics and telli count toward the 3 required partner technologies. Even if they do not, the stack above already includes Google DeepMind and Entire from the FAQ list, plus Tavily or Lovable as optional additions.

## Side Challenges

### Entire

Pursue strongly.

Use it for alert review tasks, action tracking, false-positive marking, incident records, and voice error reports.

### Aikido

Pursue if setup is quick.

Connect the public GitHub repo and include the required security report screenshot. Aikido does not count toward the 3 required partner technologies.

## Recommendation

Prioritize:

1. telli + ai-coustics track fit
2. Entire side challenge
3. Aikido side challenge

Minimum side-challenge implementation:

- Entire: one created review/error task containing video context, transcript, command, and action.
- Aikido: one connected repo scan screenshot.
