4a approved — and note the OrbitUndoChipUI fix in the README as a real defect
caught by LEAF, since it would have hung on device too.

Before 4b, one thing: bake the current AI summaries into a static file.

- Write the cached summary/urgency/requiresResponse values into
  assets/orbit-summaries-baked.json, keyed by message id.
- On launch, load baked values first. Only call Gemini for ids missing from
  that file, or when a config flag forces a live re-summarize.
- Reason 1: urgency drifted between the Friday dump and today (Marcus 1.00 vs
  Recruiting 1.00), so the centre card isn't stable across re-summarize. I'm
  filming multiple takes.
- Reason 2: a judge cloning this repo has no RSG tokens. With baked summaries
  they see the real experience instead of placeholders. Keep the live path
  fully intact and prove it still works with the flag on.

Then verify the ring matches today's layout, and I'll /clear before 4b.