Phase 2 of 4 for Orbit. Add flick triage to the ring built in phase 1. Do not
add AI or the reply flow yet — phase 3 covers those. Plan before you code.

## THE GESTURE
Use /specs-interaction-recipes for pinch-and-flick on a card. Direction
determines the action:

- LEFT  → snooze. The card slides off toward the left and is removed from the
          visible ring, returning to the queue after a simulated 1 hour.
- RIGHT → archive. The card dissolves with a particle effect via /vfx-graph.
- UP    → pin. Phase 2 stub: the card flies up and out and is marked pinned.
          Real wall-placement comes later if there's time — leave a clean
          seam for it.
- DOWN  → reply. Phase 2 stub: log the intent and return the card to the ring.
          Phase 3 replaces this.

## AFFORDANCES
- The moment a card is grabbed, four faint directional icons appear around it
  showing what each direction does. They fade in over 150ms.
- As the hand moves toward one direction, that icon brightens proportionally
  to travel distance and the others dim. The user should be able to change
  their mind mid-gesture and see that they can.
- The card itself follows the hand with slight lag and tilts into the movement
  direction, so it feels weighted rather than glued to the fingertips.

## THRESHOLDS — this is the most important part of this phase
- Require BOTH a minimum 12cm travel from the grab origin AND a release
  velocity above a threshold to commit. Tune the velocity threshold by testing
  — it must be impossible to trigger by casually moving your hand while
  holding a card, and effortless to trigger deliberately.
- If travel exceeds 12cm but velocity is below threshold, the card springs
  back to its ring position over 300ms. Do not commit a slow drag.
- Below either threshold, the card returns to its slot with a soft settle.
- Only one card may be grabbed at a time.

## UNDO — mandatory
Every triage action shows a 4-second undo chip in the lower field of view,
with a depleting progress line. Pinching it restores the card to its exact
previous ring position with a reverse animation. Undo must work for snooze,
archive and pin. This Lens performs destructive-feeling actions on a user's
messages; the undo is what makes it feel safe enough to use quickly.

## RING REFILL
When a card leaves, the remaining cards re-flow into the arc over 400ms with
staggered easing, and the next queued message animates in at the newly empty
outer position. Never leave a gap in the ring.

## EMPTY STATE
When the queue is exhausted, show a calm completion state — a simple mark and
one line of text, centred. Not blank space, and not a celebration animation.

## AUDIO
Use /build-sfx for: a light card-lift click on grab, a directional whoosh
matching the flick direction (four variants, panned to match), a soft dissolve
for archive, and a distinct low tone for undo. Everything under -20dB and
spatialized at the card's position, not on the camera. No music.

## ACCEPTANCE CRITERIA FOR THIS PHASE
- A deliberate rightward flick archives a card, every time.
- Waving my hand around while holding a card does NOT trigger anything.
- A slow drag past 12cm springs back rather than committing.
- Undo restores a card to the exact position it left from.
- The ring refills with no visible gap.

Use /specs-preview-interaction to drive simulated pinch and drag actions and
test these yourself before telling me it's done. Then /verify-preview.
