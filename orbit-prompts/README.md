# How to run these prompts

Put this whole `orbit-prompts/` folder inside your Lens Studio project folder — the
same folder Claude Code is running in. Then you never paste a prompt again.

## Running a phase

In Claude Code, type one short line:

```
Read orbit-prompts/01-ring.md and follow it as my instructions for this phase.
```

Or use an @-reference, which is shorter:

```
@orbit-prompts/01-ring.md
```

That's it. Two seconds of typing instead of a 79-line paste, and no risk of the
terminal eating your newlines.

## Order

| File | When |
|---|---|
| `00-setup.md` | Already done if the router ran and the preview is clean |
| `01-ring.md` | Data layer + the ring. Stop when 12 cards render. |
| `02-flick-triage.md` | The gesture. Budget iteration time here. |
| `03-ai-and-reply.md` | Summaries + voice reply |
| `04a-leaf-tests.md` | LEAF scenarios |
| `04b-performance.md` | Perf trace, attribution, optimize |
| `05-optional-hand-menu.md` | Only if everything above is verified |
| `06-optional-pin-to-wall.md` | Only if everything above is verified |

Between each phase, look at the preview with your own eyes before moving on.

## Why this is better than pasting

Beyond avoiding the paste problem: these files become your **prompt log**, which is
a required submission artifact and part of the 50% CLAD-execution score. Commit them
to the repo. When you write a corrective prompt because something came back wrong,
append it to the bottom of that phase's file under a `## Correction 1` heading with
one line on what went wrong. A log that shows you catching and fixing problems is
worth more than one where everything worked first try — the second kind isn't
believable.

## Follow-up prompts

Short corrections you can just type directly, no file needed:

```
The ring is following my head. It should be body-anchored with lazy-follow —
only re-centre after I turn more than 45 degrees and hold for 0.5s. Fix it and
verify with /verify-preview.
```

```
Summaries are restating the subject line instead of the ask. Rewrite the
system prompt so each summary states what the sender WANTS in under 12 words,
then re-run against all 24 messages and show me the output.
```

```
The flick is firing when I move my hand casually. Raise the release velocity
threshold, test three values with /specs-preview-interaction, and tell me which
one you picked and why.
```
