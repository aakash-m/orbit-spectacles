Final ship pass — lock the build.

1. Disable debugForceEmptyKey and debugReplyKey.
2. Confirm off/inert in the default build: replyTestMode, flickDebug,
   testHeadYawOverride, debugAutoOpen, aiForceResummarize.
3. Clear the stale test entry from the prototype outbox so it starts empty.
4. Confirm aiDraftModel is gemini-2.5-flash and baked summaries load with no
   live re-summarize.
5. Re-run the full LEAF suite with the debug seams off — all 10 must pass.
   Reset the preview camera to identity first.
6. Cold start, zero Orbit console errors or warnings.
7. Confirm the ring is still the frozen layout, Recruiting (m08) dead centre.
