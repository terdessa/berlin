# Partner Technology Plan

Sentinel must use at least 3 partner technologies to qualify.

## Current Integration Strategy

The cleanest current plan is to make partner technologies visible in the demo flow:

- Google DeepMind for analyzing the mobile phone livestream and producing the alert summary
- Lovable for rapidly building or scaffolding the dashboard UI
- Entire for human-in-the-loop alert review, store-team action, or incident workflow

Possible additions:

- Tavily for retrieving store policies, loss-prevention procedures, or response guidance
- Gradium or ai-coustics if audio from the shop stream becomes important
- Pioneer if the team wants to show evaluation, synthetic data, or a smaller specialized detector

## Candidate Uses

### Google DeepMind

Use for multimodal reasoning, scene understanding, event summarization, or alert explanation. In the current demo, this is the strongest fit for the AI-analyzed phone livestream.

### Gradium

Use for real-time voice or audio intelligence if the demo includes noisy shop audio, spoken staff notes, or operator interaction.

### ai-coustics

Use for robust audio enhancement in noisy retail environments, especially if positioning toward the telli and ai-coustics track.

### Entire

Use for human-in-the-loop workflows such as reviewing alerts, sending a floor associate, marking false positives, creating incident records, or collaborating on store response.

### Lovable

Use for quickly building the dashboard UI or prototype shell.

### Tavily

Use for retrieving relevant store policies, loss-prevention procedures, response guidance, or camera-zone context after an alert.

### Pioneer

Use for fine-tuning, synthetic data generation, evaluation, or replacing a general-purpose LLM call with a smaller specialized classifier.

## Open Questions

- Which 3 technologies will be easiest to integrate visibly and credibly?
- Which partner technology best aligns with the chosen track?
- Which integrations are real product dependencies versus demo accelerators?
- Should audio be part of the first demo, or should the first demo focus on visual detection?
