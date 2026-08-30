/**
 * Orbit — OrbitReplyService (phase 3).
 *
 * Turns (original message + spoken intent) into a complete draft reply via
 * Gemini. The draft must match the FORMALITY AND REGISTER of the original: a
 * terse Slack line gets a terse reply, a formal client email gets a formal one.
 * That mirroring is stated explicitly in the system prompt and is an acceptance
 * criterion for the phase.
 *
 * One call per reply (not batched). Model is OrbitConfig.aiDraftModel — a
 * per-call knob, so it can drop to gemini-2.0-flash without a rebuild if the
 * round-trip creeps over 4 s. Hard timeout so the flow never hangs; on any
 * failure the caller falls back to an editable stub draft.
 */

import { Gemini } from "RemoteServiceGateway.lspkg/HostedExternal/Gemini"
import { GoogleGenAITypes } from "RemoteServiceGateway.lspkg/HostedExternal/GoogleGenAITypes"
import { OrbitMessage } from "./OrbitTypes"
import { OrbitConfig } from "./OrbitConfig"

const SYSTEM_PROMPT = `You draft a reply to a message on behalf of the reader, from a short spoken intent.

Rules:
- Output ONLY the reply body. No greeting line unless the original had one, no signature, no quotes, no preamble, no "Here's a draft".
- MATCH THE ORIGINAL'S FORMALITY AND REGISTER EXACTLY. A terse Slack/chat message gets a terse reply — lowercase, no sign-off, one or two lines. A formal client email gets full sentences, a courteous opener, and a sign-off. Mirror the sender's punctuation and warmth.
- Say what the intent says and nothing more. Do not invent commitments, dates, names, or details that are not in the intent or the original.
- If the intent is vague, keep the reply short and non-committal rather than padding it.
- Write in first person as the reader replying.`

const DRAFT_TIMEOUT_SECONDS = 12

@component
export class OrbitReplyService extends BaseScriptComponent {
  onAwake(): void {}

  /**
   * Draft a reply. Resolves with the reply text; rejects on timeout / API error
   * so the caller can drop to an editable stub.
   */
  draft(message: OrbitMessage, intent: string): Promise<string> {
    // LEAF test seam: canned draft, no network.
    if (OrbitConfig.replyTestMode) {
      return Promise.resolve("Test draft for " + message.senderName + ": " + intent.trim())
    }

    const userText =
      "ORIGINAL MESSAGE\n" +
      "from: " +
      message.senderName +
      " (" +
      message.source +
      ")\n" +
      "---\n" +
      message.body +
      "\n---\n\n" +
      "SPOKEN INTENT FROM THE READER\n" +
      intent.trim() +
      "\n\nWrite the reply body now."

    const req: GoogleGenAITypes.Gemini.Models.GenerateContentRequest = {
      model: OrbitConfig.aiDraftModel,
      type: "generateContent",
      body: {
        contents: [{ role: "user", parts: [{ text: userText }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.4,
        },
      },
    }

    return this.withTimeout(Gemini.models(req), DRAFT_TIMEOUT_SECONDS).then((resp) => {
      const text = this.extractText(resp)
      return text.trim()
    })
  }

  private extractText(resp: GoogleGenAITypes.Gemini.Models.GenerateContentResponse): string {
    const c = resp && resp.candidates && resp.candidates[0]
    const parts = c && c.content && c.content.parts
    let out = ""
    if (parts) {
      for (const p of parts) if (p && typeof p.text === "string") out += p.text
    }
    if (!out) throw new Error("empty draft response")
    return out
  }

  private withTimeout<T>(p: Promise<T>, seconds: number): Promise<T> {
    const timeout = new Promise<T>((_resolve, reject) => {
      const ev = this.createEvent("DelayedCallbackEvent")
      ev.bind(() => reject(new Error("draft timeout after " + seconds + "s")))
      ev.reset(seconds)
    })
    return Promise.race([p, timeout])
  }
}
