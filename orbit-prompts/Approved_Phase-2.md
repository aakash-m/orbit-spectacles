1. Yes, install AiPreviewAgentInteract.lspkg and add the agent scripts.

2. No to the scaled clock — it would make relative-time labels drift during a
demo recording, which looks broken on video. Decouple instead:
   - The global clock stays real time. Relative labels ("23m ago") are computed
     against real now, always.
   - Snooze duration is a config constant, SNOOZE_RETURN_SECONDS, separate from
     the label shown to the user. The chip still says "1 hour".
   - Defaults: 45 seconds for normal running, so a snoozed card visibly returns
     during a demo. LEAF sets it to 0.1 for tests.
   Put the constant somewhere obvious so I can change it without hunting.

3. Confirmed — DOWN is a stub in phase 2. Logs, fires the event, springs back,
no undo. Phase 3 replaces it with the reply flow. Keep the seam clean.

Also: did you resolve the additive-display question from phase 1? Cards read
fine in the preview composite, but I still need to know whether dark
translucent gives real contrast on device. One line is enough.

Approved otherwise — go.