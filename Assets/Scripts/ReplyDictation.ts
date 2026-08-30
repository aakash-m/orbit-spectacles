/**
 * Orbit — ReplyDictation (phase 3).
 *
 * Thin wrapper around LensStudio:AsrModule for the reply flow. Emits the live
 * partial transcript as the user speaks, and a final transcript when they stop.
 *
 * PREVIEW REALITY: ASR produces no transcript in Lens Studio Preview — the gRPC
 * stream is cancelled immediately (verified). So this also runs a watchdog: if
 * no transcription update arrives within FALLBACK_AFTER_SECONDS, or ASR errors,
 * it emits OrbitConfig.simulatedDictationText with `simulated = true`. The panel
 * shows that state as an explicit "Simulated transcript" — never disguised as
 * real dictation. On device, real speech beats the watchdog and this never fires.
 *
 * Plain class (not a component): it borrows the owner ScriptComponent only for
 * createEvent (DelayedCallbackEvent).
 */

import { OrbitConfig } from "./OrbitConfig"

const FALLBACK_AFTER_SECONDS = 3.5
const SILENCE_TERMINATION_MS = 1200

export interface DictationResult {
  text: string
  simulated: boolean
}

export class ReplyDictation {
  private asr: any = null
  private owner: BaseScriptComponent
  private running = false
  private updateCount = 0
  private watchdog: DelayedCallbackEvent | null = null

  private onPartial: (text: string) => void = () => {}
  private onFinal: (r: DictationResult) => void = () => {}

  constructor(owner: BaseScriptComponent) {
    this.owner = owner
  }

  /**
   * Begin dictation. `onPartial` fires repeatedly with interim text; `onFinal`
   * fires once with the settled result (real or simulated).
   */
  start(onPartial: (text: string) => void, onFinal: (r: DictationResult) => void): void {
    this.onPartial = onPartial
    this.onFinal = onFinal
    this.updateCount = 0
    this.running = true

    // LEAF test seam: skip ASR entirely, resolve to the simulated intent next frame.
    if (OrbitConfig.replyTestMode) {
      const ev = this.owner.createEvent("DelayedCallbackEvent")
      ev.bind(() => this.fallback())
      ev.reset(0)
      return
    }

    try {
      this.asr = require("LensStudio:AsrModule")
      const options = AsrModule.AsrTranscriptionOptions.create()
      options.mode = AsrModule.AsrMode.HighAccuracy
      options.silenceUntilTerminationMs = SILENCE_TERMINATION_MS
      options.onTranscriptionUpdateEvent.add((e: AsrModule.TranscriptionUpdateEvent) => {
        if (!this.running) return
        this.updateCount++
        if (e.isFinal) {
          if (e.text && e.text.trim().length > 0) {
            this.finish({ text: e.text.trim(), simulated: false })
          }
        } else {
          this.onPartial(e.text)
        }
      })
      options.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
        print("[ReplyDictation] ASR error " + code + " — using simulated transcript")
        this.fallback()
      })
      this.asr.startTranscribing(options)
    } catch (e) {
      print("[ReplyDictation] ASR unavailable (" + e + ") — using simulated transcript")
      this.fallback()
      return
    }

    // Watchdog: no updates soon → we're almost certainly in Preview.
    this.watchdog = this.owner.createEvent("DelayedCallbackEvent")
    this.watchdog.bind(() => {
      if (this.running && this.updateCount === 0) this.fallback()
    })
    this.watchdog.reset(FALLBACK_AFTER_SECONDS)
  }

  /**
   * User pressed "Done" — settle whatever we have. If ASR gave us partials, take
   * the latest; otherwise fall back to the simulated line.
   */
  finishNow(latestPartial: string): void {
    if (!this.running) return
    if (this.updateCount > 0 && latestPartial && latestPartial.trim().length > 0) {
      this.finish({ text: latestPartial.trim(), simulated: false })
    } else {
      this.fallback()
    }
  }

  stop(): void {
    this.running = false
    if (this.asr) {
      try {
        this.asr.stopTranscribing()
      } catch (e) {
        // ignore
      }
    }
  }

  private fallback(): void {
    if (!this.running) return
    this.finish({ text: OrbitConfig.simulatedDictationText, simulated: true })
  }

  private finish(r: DictationResult): void {
    if (!this.running) return
    this.running = false
    if (this.asr) {
      try {
        this.asr.stopTranscribing()
      } catch (e) {
        // ignore
      }
    }
    this.onFinal(r)
  }
}
