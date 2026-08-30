Decisions:

1. Local persistentStorageSystem. Yes. No backend, no Snap Cloud.

2. gemini-2.5-flash for summarization — quality there is the whole product and
it's batched + cached at launch, so latency barely matters. Start with
2.5-flash for drafting too; if draft round-trip exceeds 4s, drop the draft call
only to 2.0-flash and tell me. Make the model a per-call config knob so I can
switch without a rebuild.

3. Palm-orientation menu is acceptable, with a guard: require the palm-facing
state to hold for 0.4s before showing, and 0.4s of not-facing before hiding, so
it can't flicker while I'm triaging. If this eats more than 30 minutes, stub
the outbox as a static panel and move on — it's the least important thing in
this phase.

4. Yes on token regeneration. But tell me what happens if a token expires
MID-session: I need cached summaries to keep rendering and the ring to stay
fully usable, with no error spam and no blank cards. Failing to a working
offline state is required, not optional.

BEFORE you build the reply flow — resolve the ASR question first and tell me
the answer. Try real dictation in Preview and report whether it produces a
transcript. This decides whether I can film the voice reply at all, and I have
no hardware. If preview dictation is silent:
  - keep the canned-intent path, but make it visibly labelled in the UI as a
    simulated transcript, not disguised as real ASR
  - tell me immediately so I can plan the demo around it

Then proceed. When summaries come back, dump all 24 for me to read before you
call the phase done.