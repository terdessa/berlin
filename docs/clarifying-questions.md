# Clarifying Questions

This file tracks the discovery process for making Sentinel clear, shareable, and buildable.

## How To Use

For each question:

- write the question
- record the answer
- capture feedback or implications
- update related docs if the answer changes direction

## Questions

### 1. Primary Environment

Question:

What is the primary environment Sentinel should be built for in the hackathon demo?

Example B2B retail options include supermarket, convenience store, pharmacy, electronics shop, fashion retail store, high-value goods section, checkout area, self-checkout area, or stockroom entrance.

Answer:

The team is moving toward B2B retail loss-prevention awareness after judge feedback that a private solution is stronger than a B2G approach. The primary demo environment should be a supermarket or shop where a security operator monitors many cameras at once.

Feedback:

This gives Sentinel clearer buyers, a direct ROI story, easier demo constraints, and a sharper user pain: one person cannot watch every retail camera all the time. Future questions should focus on the shop layout, the review-worthy behavior, the human action, and the exact non-accusatory alert language.

### 2. Core User

Question:

Who is the primary human user sitting in front of Sentinel?

This can stay role-based within the B2B retail framing. For example, is the user best described as a security operator, loss-prevention associate, store manager, retail operations manager, security supervisor, or business owner?

Answer:

The exact job title should remain flexible within retail. The user could be a security operator, loss-prevention associate, store manager, retail operations manager, security supervisor, or business owner.

Feedback:

This suggests Sentinel should define its user by responsibility rather than title. The clearest reusable persona is: a retail human responsible for noticing, assessing, and responding to high-risk situations across many live camera feeds.

### 3. User Responsibility

Question:

What is the main responsibility Sentinel should help this person with?

For example, should Sentinel primarily help them notice incidents faster, decide what happened, choose the right response, document the incident, coordinate other people, or reduce false alarms?

Answer:

Sentinel should draw attention very quickly to retail cameras that may need review. The core responsibility is reducing the latency between an observable high-risk retail event happening and the security operator noticing it. This could mean highlighting a camera when someone takes an item from a shelf and appears to place it into a pocket or bag.

Feedback:

This is a strong core value proposition. Sentinel is not primarily a reporting tool, a generic camera analytics system, or an automated accusation system. It is an attention-routing layer for retail security. The most important product promise is: review-worthy moments get noticed faster, understood faster, and routed to the right human faster.

### 4. Alert-Worthy Events

Question:

What should make something important enough for Sentinel to interrupt a human?

For retail, should Sentinel alert on observable sequences such as shelf-to-pocket movement, shelf-to-bag movement, checkout bypass, self-checkout mismatch, unusual high-value shelf behavior, or other events that deserve human review?

Answer:

Sentinel should interrupt a human when it notices obvious observable retail facts that deserve review by the security operator.

Examples include:

- item taken from shelf and placed into pocket or bag
- concealment-like hand motion
- item carried past checkout without an observed scan
- self-checkout mismatch
- repeated shelf-to-bag movement
- unusual activity near high-value items
- other visible signals that indicate a camera deserves review

Feedback:

This creates a useful alert rule: Sentinel should focus on observable evidence rather than vague suspicion. The product should not claim theft, guilt, intent, or identity. It should say: "This camera shows an observable sequence that deserves human review." This is safer, more explainable, and easier to demo.

### 5. Alert Explanation

Question:

When Sentinel creates an alert, what should it show the human so they can quickly trust and act on it?

For example: short description, severity level, confidence, exact camera/feed, what evidence was detected, replay clip, audio transcript, suggested response, nearby resources, or similar past incidents.

Answer:

The reference UI shows a dark live camera map pattern with multiple camera pins. For Sentinel, this should become a supermarket or shop floor plan. Active cameras are neutral/white, and the triggered camera pings in red with an "ALERT" label. A small status panel shows online camera count, and a legend distinguishes active cameras from alert cameras.

Feedback:

This is a strong demo direction because it communicates the whole product in one glance: many monitored cameras, one review-worthy location, and a clear reason for human attention. The map view should now become a supermarket floor plan, shop layout, aisle map, checkout view, exit view, or high-value shelf section.

### 6. Alert Detail Level

Question:

After a camera marker turns red, what should happen next when the user clicks or opens the alert?

For example, should Sentinel open a side panel with the camera feed, event summary, replay clip, confidence/severity, suggested action, and buttons like acknowledge, watch live, send floor associate, ignore, or create incident record?

Answer:

The demo should use around 10 CCTV-style retail videos displayed as dummy camera feeds. One feed should be a real mobile phone livestream. The livestream is the feed Sentinel analyzes for a real triggered event, such as a staged shelf-to-pocket or shelf-to-bag sequence. The AI should notice the observable sequence and flag that camera for human review.

From the map interface, the user can click any camera. This opens an almost fullscreen popup with:

- camera live view
- ability to rewind briefly, such as around 10 seconds
- ability to return to live
- right-side camera metadata such as location, coordinates, and camera ID

When the camera is in alert state, the same view opens with a red frame. The alert view should include:

- live camera view
- camera metadata
- split-screen alert evidence clip showing the short fragment that triggered the alert
- short AI summary
- event moment
- aisle, checkout, exit, or shelf location where it happened
- relevant review action, such as watch live, send floor associate, mark false positive, or create incident record

Feedback:

This is a practical hackathon demo architecture. Dummy CCTV videos make the system feel large-scale, while one real mobile livestream proves the AI path is not only mocked. The strongest detail is the split between live view and the short evidence clip, because it lets the operator understand both "what is happening now" and "why Sentinel interrupted me."

### 7. Real AI Scope

Question:

For the hackathon demo, which parts must be genuinely AI-powered live, and which parts can be simulated or prefilled for reliability?

For example, must the model truly detect the staged shelf-to-pocket sequence from the phone stream in real time, or is it acceptable to trigger the alert manually while using AI for the summary and response context?

Answer:

The demo should make only one feed genuinely AI-powered live: the mobile phone livestream used for the staged demo event. Other camera markers should open previewable feeds, but those can be endless loop videos pretending to be live cameras.

Looped retail videos should replace public webcam streams to keep the demo reliable and aligned with the B2B retail positioning. The AI engine should only run on the mobile phone livestream for the hackathon demo.

Feedback:

This is the right reliability boundary. The product can visually communicate many monitored store cameras while keeping the risky real-time AI integration focused on one controlled stream. That makes the demo easier to build, easier to debug, and less dependent on legally or technically unpredictable external feeds.

### 8. AI Detection Output

Question:

When the AI analyzes the mobile phone livestream, what exact output should it produce for the rest of the system?

For example, should it return event type, severity, confidence, short summary, evidence start and end, recommended response, and whether the alert should trigger?

Answer:

Pending.

Feedback:

Pending.
