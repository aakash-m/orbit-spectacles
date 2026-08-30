Project: Orbit, a spatial message-triage Lens for SPECS in this Lens Studio
project (D:\Snap_Project\Orbit). Phases 1-3 built and verified. Phase 4a LEAF
suite passing 10/10. AI summaries are baked into a static JSON and the ring
order is frozen for filming. Phase 4b, the performance pass, has NOT run yet.

First: fix all 5 issues /code-review found in Assets/Scripts/OrbitAiService.ts
(empty summary cached as valid, partial/id-mismatch batch responses skipping
the fallback, withTimeout leaking its DelayedCallbackEvent, hallucinated ids
written to storage, dead this.dumped/rr state).

Hard constraints while you do it:
- Do NOT trigger a live re-summarize. The baked summaries and the ring order
  must be byte-identical afterwards. I'm filming against this exact layout.
- Do NOT restart to update Claude Code. We stay on this version until I've
  submitted.
- For issue 2, an id-mismatched or missing response must fall back explicitly
  and log which message ids fell back, so a silent placeholder is impossible.

Then confirm the baked file still contains a real summary for all 24 ids with
none blank, and show me the ring is unchanged.

After that, read orbit-prompts/04b-performance.md and run the phase 4b
performance pass.