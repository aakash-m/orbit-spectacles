Phase 4a for Orbit. Install LEAF with /specs-leaf-install-packages, then use
/specs-leaf-write-scenarios to write these scenarios:

1. The mock dataset loads and renders 12 cards sorted by urgency descending.
2. A rightward flick above both the travel and velocity thresholds archives a
   card.
3. A rightward movement above travel but BELOW velocity threshold does not
   archive — the card springs back.
4. Undo restores an archived card to its exact prior ring position.
5. Flicking down opens the reply panel containing the full message body.
6. With the AI service stubbed to fail, all 12 cards still render with
   placeholder summaries and the ring is fully usable.
7. Send requires two presses within the 3-second confirm window; one press
   does not send.
8. Cancelling a reply returns the card to the ring unchanged.
9. Ring refill: after archiving a card, no gap remains and a queued message
   appears.
10. Head rotation of 30 degrees does not re-centre the ring; 50 degrees held
    for 0.5s does.

Run them with /specs-leaf-run-in-preview and fix anything that fails. Show me
the final run output.

## Correction 1 — real defect caught by LEAF (OrbitUndoChipUI)

S04 (undo restores position) hung instead of passing. Cause was a genuine Lens
bug, not a test bug: `OrbitUndoChipUI.trigger()` set `this.sceneObject.enabled =
false` **synchronously inside the `onTriggerStart` callback**, yanking the
collider out mid-interaction. SIK's trigger sequence (and LEAF's synthetic
`trigger()`) then wait forever on `onTriggerEnd`, which never fires for a
disabled interactable. On real Spectacles this is the same hazard — a pinch that
disables its own target between TriggerStart and TriggerEnd can strand the
interaction. Fix: `trigger()` collapses state immediately and runs the undo
callback, but defers `sceneObject.enabled = false` by 0.15 s (`hideNextFrame`)
so the in-flight trigger completes first. All 10 scenarios pass after the fix.

Also tuned in-test only (no Lens change): LEAF's card drag runs in Direct
targeting mode (Indirect adds a far-ray "stretch" that scrambles flick
direction), and reply-panel buttons are driven via `ReplyFlowController`
test seams because LEAF's camera→target raycast crashes on head-locked UI.

## Correction 2 — INTERNAL_ERROR vs real assertion failure

Prompted by `PreviewInteractTool` (the preview puppet LEAF drives) wedging with
`INTERNAL_ERROR` roughly one run in three, and not wanting agent flakiness
reported as Lens defects. Handled as a reporting rule, not a Lens or test
change: a failed scenario is classified — an agent `INTERNAL_ERROR` (or MCP
timeout) is retried up to 3 times and reported separately from a real
assertion failure, which is surfaced as a defect immediately.
