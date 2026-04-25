# Sentinel Idea Brief

## One-Line Pitch

Sentinel turns passive video and audio streams into real-time awareness.

## Concept

Sentinel is a real-time multimodal AI system for retail loss-prevention awareness. It monitors live shop camera streams, with optional audio context, detects high-risk situations that may require human attention, and alerts operators with concise, actionable context.

## Problem

Retailers already capture large amounts of video across supermarkets, shops, pharmacies, and convenience stores, but most monitoring systems are passive. Footage is often reviewed after an incident, and one security operator may have to watch many feeds at once.

High-risk retail moments can be noticed too late.

The central problem is latency between a review-worthy camera moment happening and the right person noticing it.

## Solution

Sentinel continuously analyzes live feeds and surfaces moments that matter.

When a relevant situation is detected, it:

- highlights the affected camera or area
- creates an alert
- summarizes what appears to be happening
- provides evidence or replay context
- lets a human acknowledge, watch live, send a floor associate, create an incident record, or dismiss the alert

## UI Concept

The strongest current UI concept is a live retail camera map or store floor plan:

- all monitored cameras appear as pins on a map or site layout
- normal cameras appear in a neutral active state
- the triggered camera pulses red and shows an alert label
- the operator can open the alert to inspect evidence and decide what to do

This can work as a supermarket floor plan, shop layout, aisle map, checkout area view, or high-value shelf overview.

## Prototype Demo Concept

The prototype should show multiple previewable retail camera feeds, plus one real mobile phone livestream. Most feeds can be endless loop videos representing store cameras.

The mobile phone livestream is the only feed that Sentinel needs to analyze for a staged retail high-risk event during the hackathon demo.

When the alert is triggered, the selected camera opens in an almost fullscreen view with a red frame, live video, a short evidence clip from the triggering moment, camera metadata, an AI summary, and response context.

The normal camera preview should show a large live video area, playback controls, return-to-live control, camera details, and an add note action. The alert version should feel like the same view upgraded into an urgent state, not a separate product surface.

## Core Value

Sentinel reduces possible loss-event-to-review latency.

It helps ensure high-risk retail moments are noticed at all, then helps the right person review evidence faster.

## Alert-Worthy Events

Sentinel should alert when it detects clear visual signals that may indicate a retail loss-prevention review moment, such as:

- item taken from a shelf and placed into a pocket or bag
- concealment-like hand movement
- item carried past checkout without an observed scan
- self-checkout scan mismatch
- repeated shelf-to-bag movement
- unusual movement near high-value shelves
- other observable behavior that may deserve human review

The system should describe observed evidence rather than infer identity, intent, guilt, or theft.

## Primary User

The primary user is not defined by a fixed job title yet. Sentinel is for the person responsible for monitoring many live shop cameras and deciding what to do when something important deserves review.

This role could map to a security operator, loss-prevention associate, store manager, retail operations manager, private security supervisor, or business owner.

## Current Vertical

### B2B Retail Loss-Prevention Awareness

Detect observable high-risk retail behaviors that deserve attention from a human security operator, without accusing anyone or making automated enforcement decisions.

## Current Framing Choice

Sentinel should now be described as a B2B real-time awareness layer for retail loss prevention. Do not frame the product as a B2G city surveillance, public emergency-response, or automated theft accusation system.

## Positioning Guardrails

- Avoid making claims of perfect detection.
- Avoid automated accusation, enforcement, or punishment framing.
- Emphasize human review and faster awareness.
- Avoid facial recognition and identity tracking.
