Summaries approved — they state the ask, not the topic, and the FYI demotions
on the self-resolving threads are correct.

One fix: seven messages tie at 0.90, so their ring order is arbitrary and could
change if the cache is invalidated and it re-summarizes. Add a deterministic
tie-break: urgency desc, then receivedAt desc, then id asc. The centre card
must be the same on every run — I'm filming multiple takes and the ring can't
reshuffle between them.

Also, quick sanity check: show me the ring in the preview so I can eyeball the
re-sorted layout before we go further.

2. On the simulated dictation path: make sure the reply panel visibly labels it
as a simulated transcript when ASR is unavailable, not styled to look like live
dictation. I'm going to film this and I won't misrepresent it.

Then run phase 4a with this caveat: PreviewInteractTool wedges with
INTERNAL_ERROR roughly 1 try in 3. When a LEAF scenario fails, distinguish an
agent INTERNAL_ERROR from a real assertion failure, retry the former up to 3
times, and report them separately. I don't want agent flakiness reported as
Lens defects.