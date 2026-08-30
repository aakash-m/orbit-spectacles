Phase 3 of 4 for Orbit. Add AI summarization and the voice reply flow. Plan
before you code.

## AI SUMMARIZATION
- Use /specs-ai-remote-service with Gemini chat completions to process each
  message into a strict JSON response containing:
  - summary: at most 12 words stating what the sender WANTS, not what the
    message says. "Needs the deck before Thursday's board call" — not
    "Regarding the board deck". This distinction is the entire value of the
    feature; put it in the system prompt explicitly with examples.
  - urgency: 0-1
  - requiresResponse: boolean
- Batch requests in groups of 6. Do not make one call per message.
- Cache results by message id in persistent storage so relaunching does not
  re-summarize. Show the cached ring immediately on launch, then update in
  place as fresh results arrive.
- HARD FALLBACK: if a call fails or times out after 8 seconds, keep the
  phase-1 placeholder summary and a neutral 0.5 urgency for those messages.
  The ring must render fully and be completely usable with no AI at all. Make
  sure I can demo this by flipping one config flag.
- Re-sort the ring by AI urgency once results arrive, animating cards to their
  new positions over 800ms rather than snapping.

## VOICE REPLY
Flicking DOWN now opens the reply flow instead of the phase-2 stub.

1. The card expands into a reply panel, 30cm wide, showing the full message
   body, scrollable if long. Other cards dim to 30% and push back 15cm so the
   panel has visual focus.
2. Use /specs-asr for dictation. The user speaks their intent in plain terms,
   e.g. "tell her Thursday works but push it to 3". Show the live partial
   transcript as they speak so they know they're being heard.
3. Send the original message plus the dictated intent to Gemini via
   /specs-ai-remote-service, requesting a complete draft reply that matches
   the formality and register of the original message. A terse Slack message
   gets a terse reply; a formal client email gets a formal one. State this in
   the system prompt.
4. Show the draft in a panel with three actions:
   - Send
   - Redraft (re-dictate, replacing the intent)
   - Edit (opens /specs-keyboard for manual correction)
5. SEND IS TWO-STEP. Pressing Send shows a confirm state that must be pressed
   again within 3 seconds, then reverts. Never send on a single gesture.
6. "Sending" writes to a local outbox. Label it "Outbox (prototype)" in the
   UI — this is a prototype and the interface should be honest about it.
   Add an outbox view to a palm-up hand menu listing sent drafts.
7. Escape hatches: a Cancel action at every step returns the card to the ring
   unchanged. Gaze-away for 2s does NOT cancel — this flow is deliberate and
   should not be dismissed by accident.

## AUDIO
Add via /build-sfx: a soft rising tone on dictation start, a settle tone when
the draft appears, a confirmation chime on send. Keep consistent with the
phase-2 palette.

## ACCEPTANCE CRITERIA FOR THIS PHASE
- Summaries state intent, not subject. I will read all 24 and check this.
- With AI disabled by config flag, the whole Lens still works end to end.
- Dictation → draft takes under 4 seconds.
- The draft's tone visibly differs between a casual chat message and a formal
  email — test with one of each from the dataset.
- Send cannot fire in one gesture.
- Cancel at any step leaves the message untouched in the ring.

/verify-preview when done.
