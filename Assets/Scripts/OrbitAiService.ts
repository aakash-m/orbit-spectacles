/**
 * Orbit — OrbitAiService (phase 3).
 *
 * Turns each message into { summary, urgency, requiresResponse } via Gemini,
 * batched and cached. The whole point is the summary: it states what the sender
 * WANTS in ≤12 words, not what the message is about.
 *
 * Launch behaviour:
 *   1. Apply cached results from persistent storage immediately — the ring shows
 *      real summaries + urgencies with no wait.
 *   2. If OrbitConfig.aiEnabled is false, stop. The Lens runs entirely on the
 *      phase-1 placeholders + dataset urgency. No network, fully usable.
 *   3. Summarize the uncached messages in batches of aiBatchSize. Each batch
 *      that returns re-sorts the ring over aiResortSeconds (animated, not a snap)
 *      and its result is cached by message id.
 *
 * Failure is always a soft landing. A batch that errors or times out (8 s) —
 * including an RSG token that expired mid-session — leaves those messages on
 * their placeholder summary with a neutral 0.5 urgency, prints ONE concise line,
 * does not cache the failure (so a relaunch retries), and never blanks a card.
 * Any summaries already applied keep rendering.
 */

import { Gemini } from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import { GoogleGenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes"
import { OrbitMessage, compareForRing } from "./OrbitTypes"
import { MessageStore } from "./MessageStore"
import { OrbitConfig } from "./OrbitConfig"
import { OrbitRing } from "./OrbitRing"

const CACHE_PREFIX = "orbit.ai.v2."

/** Curated, frozen summaries that ship with the repo (see the file's own note). */
const BAKED = requireAsset("../orbit-summaries-baked.json") as JsonAsset

const SYSTEM_PROMPT = `You triage a professional's inbox. For each message, output what the SENDER WANTS FROM THE READER — the action or answer they are waiting on — in 12 words or fewer. This is an instruction to the reader, not a description of the message.

State the ask, not the topic:
- "Needs the revised pricing deck before Thursday's board call" — NOT "Regarding the board deck"
- "Wants a payment date for the overdue July invoice by Friday" — NOT "Following up on an invoice"
- "Asking whether to ship the onboarding change or wait for QA" — NOT "Question about onboarding"
- "Wants 30 minutes this week to hand over the migration runbook" — NOT "Handover discussion"
If the message needs nothing from the reader, say what it is in the same terse style: "FYI: API quota at 84%, no action needed."

Also judge:
- urgency: 0.0-1.0. Weigh deadlines, who is blocked, consequences of delay, and tone. A "no rush" note is low; a blocked colleague or a same-day deadline is high.
- requiresResponse: true if the reader must reply or act, false for pure FYI / "no need to reply".

Respond with ONLY a JSON array, one object per message, in the same order:
[{"id": "...", "summary": "...", "urgency": 0.0, "requiresResponse": true}]`

interface AiResult {
  summary: string
  urgency: number
  requiresResponse: boolean
}

function clamp01(n: number): number {
  if (typeof n !== "number" || isNaN(n)) return OrbitConfig.aiFallbackUrgency
  return Math.max(0, Math.min(1, n))
}

@component
export class OrbitAiService extends BaseScriptComponent {
  @input
  @hint("The ring — re-sorted (animated) each time a batch of AI urgencies arrives.")
  ring!: OrbitRing

  private store = global.persistentStorageSystem.store
  private pendingBatches = 0

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.run())
  }

  private loadBaked(): { [id: string]: AiResult } {
    try {
      const parsed = JSON.parse(BAKED.getString()) as { summaries?: { [id: string]: AiResult } }
      return parsed.summaries || {}
    } catch (e) {
      print("[OrbitAi] baked summaries file unreadable (" + e + ") — ignoring")
      return {}
    }
  }

  private applyResult(id: string, r: AiResult): void {
    MessageStore.updateState(id, {
      summary: r.summary,
      urgency: clamp01(r.urgency),
      requiresResponse: !!r.requiresResponse,
    })
  }

  private run(): void {
    const all = MessageStore.getAll()
    const force = OrbitConfig.aiForceResummarize
    const baked = force ? {} : this.loadBaked()

    // 1a. Apply the baked file first — curated, stable, no network, no tokens.
    let bakedCount = 0
    for (const m of all) {
      const b = baked[m.id]
      if (b) {
        this.applyResult(m.id, b)
        bakedCount++
      }
    }

    // 1b. Fill any remaining ids from the local persistent cache (a prior live run).
    let anyCached = false
    for (const m of all) {
      if (baked[m.id]) continue
      const raw = force ? "" : this.store.getString(CACHE_PREFIX + m.id)
      if (raw && raw.length > 0) {
        try {
          this.applyResult(m.id, JSON.parse(raw) as AiResult)
          anyCached = true
        } catch (e) {
          this.store.remove(CACHE_PREFIX + m.id)
        }
      }
    }
    if (bakedCount > 0) print("[OrbitAi] applied " + bakedCount + " baked summaries.")
    if (bakedCount > 0 || anyCached) this.ring.resort(OrbitConfig.aiResortSeconds)

    // 2. AI off → run on whatever we have (baked / cache / placeholder).
    if (!OrbitConfig.aiEnabled) {
      print("[OrbitAi] disabled by config — running on baked/cache/placeholder summaries.")
      this.dumpAll()
      return
    }

    // 3. Live-summarize only what's still missing (or everything, if forced).
    const todo = all.filter((m) => {
      if (!force && baked[m.id]) return false
      const raw = force ? "" : this.store.getString(CACHE_PREFIX + m.id)
      return !(raw && raw.length > 0)
    })
    if (todo.length === 0) {
      print("[OrbitAi] all " + all.length + " summaries from baked file + local cache — no Gemini calls.")
      this.dumpAll()
      return
    }

    print(
      "[OrbitAi] " +
        (force ? "FORCED live re-summarize of " : "live-summarizing ") +
        todo.length +
        " message(s) in batches of " +
        OrbitConfig.aiBatchSize
    )
    for (let i = 0; i < todo.length; i += OrbitConfig.aiBatchSize) {
      this.pendingBatches++
      this.summarizeBatch(todo.slice(i, i + OrbitConfig.aiBatchSize))
    }
  }

  // ── One batch ────────────────────────────────────────────────────────────
  private summarizeBatch(batch: OrbitMessage[]): void {
    const userText = batch
      .map((m) => "id: " + m.id + "\nfrom: " + m.senderName + " (" + m.source + ")\nmessage: " + m.body)
      .join("\n\n---\n\n")

    const req: GoogleGenAITypes.Gemini.Models.GenerateContentRequest = {
      model: OrbitConfig.aiSummaryModel,
      type: "generateContent",
      body: {
        contents: [{ role: "user", parts: [{ text: userText }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                summary: { type: "STRING" },
                urgency: { type: "NUMBER" },
                requiresResponse: { type: "BOOLEAN" },
              },
              required: ["id", "summary", "urgency", "requiresResponse"],
            },
          },
        },
      },
    }

    this.withTimeout(Gemini.models(req), OrbitConfig.aiTimeoutSeconds)
      .then((resp) => {
        const text = this.extractText(resp)
        const arr = JSON.parse(text) as AiResult[]

        // Track which batch ids came back with a usable (non-blank) summary.
        // Anything left uncovered — skipped by the model, blank, or answered
        // with a mismatched/hallucinated id — takes the explicit fallback
        // below. A silent placeholder is not possible.
        const resolved: { [id: string]: true } = {}
        for (const r of arr as any[]) {
          if (!r || typeof r.id !== "string") continue
          if (!MessageStore.byId(r.id)) {
            // Hallucinated id — never touch MessageStore or persistent storage.
            print("[OrbitAi] response referenced unknown id '" + r.id + "' — ignored")
            continue
          }
          const summary = String(r.summary || "").trim()
          if (summary.length === 0) continue // blank → treat as a miss, do NOT cache

          const result: AiResult = {
            summary,
            urgency: clamp01(r.urgency),
            requiresResponse: !!r.requiresResponse,
          }
          MessageStore.updateState(r.id, result)
          this.store.putString(CACHE_PREFIX + r.id, JSON.stringify(result))
          resolved[r.id] = true
        }

        // PARTIAL FALLBACK — every batch message the response didn't cover
        // gets the neutral urgency, logged by id, nothing cached (relaunch
        // retries).
        const missed = batch.filter((m) => !resolved[m.id])
        if (missed.length > 0) {
          const ids = missed.map((m) => m.id).join(",")
          print(
            "[OrbitAi] no usable summary for " +
              missed.length +
              " message(s) [" +
              ids +
              "] — fell back to placeholder + urgency " +
              OrbitConfig.aiFallbackUrgency
          )
          for (const m of missed) {
            MessageStore.updateState(m.id, { urgency: OrbitConfig.aiFallbackUrgency })
          }
        }
      })
      .catch((e) => {
        // HARD FALLBACK — the whole batch failed (error or timeout). Quiet,
        // no cache, no blank cards.
        const ids = batch.map((m) => m.id).join(",")
        print("[OrbitAi] batch [" + ids + "] fell back to placeholder (" + this.shortError(e) + ")")
        for (const m of batch) {
          MessageStore.updateState(m.id, { urgency: OrbitConfig.aiFallbackUrgency })
        }
      })
      .then(() => {
        this.ring.resort(OrbitConfig.aiResortSeconds)
        this.pendingBatches--
        if (this.pendingBatches === 0) this.dumpAll()
      })
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private extractText(resp: GoogleGenAITypes.Gemini.Models.GenerateContentResponse): string {
    const c = resp && resp.candidates && resp.candidates[0]
    const parts = c && c.content && c.content.parts
    const t = parts && parts[0] && parts[0].text
    if (!t) throw new Error("empty response")
    return t
  }

  private withTimeout<T>(p: Promise<T>, seconds: number): Promise<T> {
    let timer: DelayedCallbackEvent | null = null
    const timeout = new Promise<T>((_resolve, reject) => {
      timer = this.createEvent("DelayedCallbackEvent")
      timer.bind(() => reject(new Error("timeout after " + seconds + "s")))
      timer.reset(seconds)
    })
    // Whichever way the race settles, drop the timer so it can't fire late and
    // stays off the component's referenced-events list (one per Gemini call).
    const cancelTimer = (): void => {
      if (timer) {
        this.removeEvent(timer)
        timer = null
      }
    }
    return Promise.race([p, timeout]).then(
      (v) => {
        cancelTimer()
        return v
      },
      (e) => {
        cancelTimer()
        throw e
      }
    )
  }

  private shortError(e: any): string {
    const s = e && e.message ? e.message : String(e)
    return s.length > 80 ? s.slice(0, 80) + "…" : s
  }

  /** Print all 24 summaries for review (spec: "I will read all 24"). */
  private dumpAll(): void {
    const all = MessageStore.getAll().slice().sort(compareForRing)
    print("── OrbitAi: all " + all.length + " summaries (urgency-sorted) ──────────────")
    for (const m of all) {
      const s = MessageStore.displaySummary(m)
      print(
        m.urgency.toFixed(2) +
          "  " +
          (m.requiresResponse ? "[reply] " : "[fyi]   ") +
          m.senderName +
          " — " +
          s
      )
    }
    print("──────────────────────────────────────────────────────────────")

    if (OrbitConfig.dumpBakeJson) {
      const obj: { [id: string]: AiResult } = {}
      for (const m of all) {
        obj[m.id] = {
          summary: MessageStore.displaySummary(m),
          urgency: m.urgency,
          requiresResponse: m.requiresResponse,
        }
      }
      print("[OrbitAi][bake] " + JSON.stringify({ version: 1, summaries: obj }))
    }
  }
}
