# Open Questions

## Product

- What is the primary demo environment? Likely supermarket or shop; exact layout still open.
- Who is the primary human user sitting in front of Sentinel? Answered as a retail security or store operations decision-maker rather than a fixed job title.
- What is the main responsibility Sentinel should help this person with? Answered as reducing possible loss-event-to-review latency and ensuring review-worthy camera moments are noticed.
- What should make something important enough for Sentinel to interrupt a human? Answered as observable high-risk retail evidence such as shelf-to-pocket movement, shelf-to-bag movement, checkout bypass, self-checkout mismatch, or unusual high-value shelf activity.
- What should an alert show so the human can quickly trust and act on it? Partially answered with reference map UI: active camera pins and red pulsing alert marker.
- After a camera marker turns red, what should happen next when the user clicks or opens the alert? Answered as an almost fullscreen red-framed camera view with live feed, evidence clip, metadata, AI summary, event moment, store location, and human review actions.
- Which parts must be genuinely AI-powered live, and which parts can be simulated or prefilled for reliability? Answered: only the mobile phone livestream needs AI analysis; other feeds can be looped retail videos.
- What exact output should the AI analysis produce for the rest of the system?
- Which retail setting should be the main demo environment?
- Which hackathon track should Sentinel target?
- Which 3 partner technologies should be integrated?

## Technical

- Will the demo use phone livestream input, prerecorded clips, or simulated retail feeds?
- Which model or API will handle video understanding?
- Which tool will handle audio understanding?
- What should be real versus mocked in the prototype?
