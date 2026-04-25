# Safety Notes

## Positioning

Sentinel is a retail security awareness assistant, not an automated accusation or enforcement system.

## Guardrails

- No facial recognition
- No identity tracking
- No automated accusation
- No automated detention, punishment, or enforcement
- Human review before any store action
- Confidence shown for visual and voice outputs
- Error reports debug the system, not the guard

## Good Language

- "camera requires review"
- "item appears to move from shelf to pocket"
- "possible loss-prevention review"
- "voice command unclear"
- "clarification needed"

## Bad Language

- "this person is stealing"
- "thief"
- "criminal"
- "guilty"
- identity claims
- intent claims

## Failure Behavior

If the voice command is unclear, Sentinel should ask for clarification or create an error report. It should not take irreversible action from a low-confidence command.
