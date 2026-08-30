Make "Orbit", a spatial message triage experience, for SPECS.

This is phase 1 of 4. Build ONLY what's described here. Do not add
interaction, AI calls, or reply flows yet — later phases cover those. Plan
this phase and show me the plan before writing any code.

## CONCEPT
Messages from multiple communication platforms are rendered as cards in a ring
around the user at arm's length, sorted by urgency and grouped by source. In
later phases the user will triage them with directional hand flicks and reply
by voice. Right now I need the data layer and the ring to exist and look
right.

## DATA LAYER
- I have placed a file at assets/orbit-messages.json containing 24 messages.
  Load from that file. Do NOT generate your own dataset or modify that file.
- The Message model is: id, source (one of: email, chat, calendar, social),
  senderName, senderInitials, body, receivedAt (ISO 8601), urgency (0-1),
  threadId, requiresResponse (boolean), summary (string, initially empty).
- The `summary` field is populated by AI in phase 3. For now, derive a
  placeholder summary from the first 12 words of `body`. Build the code so
  that swapping in a real summary later is a single assignment — do not couple
  the card rendering to where the summary came from.
- Keep the message store in one module with a clean interface (getAll,
  getVisible, updateState). Every later phase will go through it.
- There is no network in this build. Do not add HTTP calls, polling, or a
  backend. The Lens must be fully functional offline — that is a hard
  requirement, not a fallback.

## THE RING
- Use /icon-selector to find four source icons (mail, chat bubble, calendar,
  social) and /font-selector to pick a clean neutral sans with a large
  x-height and clearly distinguishable numerals. Do both BEFORE
  /specs-build-ui.
- Use /specs-build-ui for world-space cards: 22cm wide x 14cm tall,
  soft-cornered, dark translucent with a blur backing.
- Arrange cards on an arc 70cm from the user, spanning 120 degrees of forward
  field, in up to 3 vertical tiers.
- The ring is BODY-anchored, not head-locked. Cards billboard to face the user
  but hold their arc position, so the user can physically turn their head to
  look at a different part of the ring. Implement lazy-follow: the ring
  re-centres on the user's body orientation only after they turn more than 45
  degrees and hold for 0.5s, then eases into the new orientation over 0.6s.
  This is important — a head-locked ring is nauseating and defeats the point.
- Sort by urgency descending. The most urgent card sits at eye level, dead
  centre. Less urgent cards drift outward and downward along the arc.
- Colour-code by source with a distinct hue per source, applied as a 4mm
  left-edge bar on the card — NOT as a tint over the whole card, which would
  compromise text contrast.
- Each card shows: sender initials in a filled circle, sender name, the
  summary line, relative time ("2h ago"), and the source icon.
- Show a maximum of 12 cards. A small counter chip in the lower field of view
  shows "+N more". Cards refill from the queue as ones are removed in later
  phases.
- Text must be legible at 70cm: minimum 1.4cm cap height. Truncate the summary
  to one line with an ellipsis rather than wrapping.

## VISUAL DIRECTION
Calm and low-density. This is a tool for someone who is already overwhelmed —
it must reduce visual noise, not add to it. Dark translucent cards, ONE
restrained accent colour, generous internal padding. Nothing pulses,
animates, or glows unless the user is acting on it. No decorative motion
whatsoever.

## PERFORMANCE
Target 60fps with 12 cards. Text rendering and blur are the likely costs —
batch text and cap blur regions. Don't optimize yet, but don't do anything
obviously expensive.

## ACCEPTANCE CRITERIA FOR THIS PHASE
- 12 cards load from the JSON file and render in the arc.
- The most urgent message is centre, at eye level.
- Source colours are distinguishable at a glance without reading.
- Turning my head 30 degrees does NOT move the ring; turning 50 degrees and
  holding does.
- All text is legible; nothing is clipped mid-word.
- Runs at 60fps with no network available.

Use /verify-preview when you're done and show me what it looks like.

## Correction 1 — additive-display contrast

Prompted by the plan proposing "dark translucent with a blur backing" cards.
SPECS displays are additive — black renders as transparent — so a dark scrim
gives no contrast on device and can't define a card edge against a bright
room. Resolved before locking the visual direction rather than deferred to the
perf pass: cards use a low-luminance fill (~0.15) plus a distinctly brighter
luminous border (~0.7), and the border is what reads on-device. The Preview
composite alpha-blends and over-represents dark-panel contrast, so fill and
border luminance are flagged for tuning on real hardware.
