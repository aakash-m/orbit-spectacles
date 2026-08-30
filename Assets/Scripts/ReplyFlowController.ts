/**
 * Orbit — ReplyFlowController (phase 3).
 *
 * The voice-reply state machine. A DOWN flick routes here (TriageController.
 * onReplyRequested → open()). Owns the sequence:
 *
 *   dictating → drafting → review → (confirm) → sent
 *                  ↑__________ redraft __________|
 *                              review → editing → review
 *
 * Wiring: the ring (push-back / dim), the reply panel (view), the reply service
 * (Gemini draft), and optionally the outbox menu (to refresh its list on send).
 *
 * Escape hatches:
 *  - Cancel at ANY step calls finish(archive=false): the message stays in the
 *    ring exactly as it was, nothing is sent.
 *  - Send is two-step: first press → confirm state, reverts after
 *    OrbitConfig.sendConfirmSeconds; only a second press within that window
 *    actually writes to the outbox.
 *  - Gaze-away does NOT cancel — deliberately not implemented. This flow is only
 *    dismissed by an explicit Cancel or a completed Send.
 */

import { OrbitRing } from "./OrbitRing"
import { OrbitReplyService } from "./OrbitReplyService"
import { ReplyPanelUI, ReplyPhase } from "./ReplyPanelUI"
import { ReplyDictation, DictationResult } from "./ReplyDictation"
import { OutboxStore } from "./OutboxStore"
import { OutboxMenuUI } from "./OutboxMenuUI"
import { OrbitConfig } from "./OrbitConfig"
import { MessageStore } from "./MessageStore"
import { OrbitMessage } from "./OrbitTypes"

const SFX_DICTATION_START = requireAsset("../GeneratedSFX/dictation-start.wav") as AudioTrackAsset
const SFX_DRAFT_SETTLE = requireAsset("../GeneratedSFX/draft-settle.wav") as AudioTrackAsset
const SFX_SEND_CHIME = requireAsset("../GeneratedSFX/send-chime.wav") as AudioTrackAsset

@component
export class ReplyFlowController extends BaseScriptComponent {
  @input
  @hint("The ring — pushed back + dimmed while a reply panel is open.")
  ring!: OrbitRing

  @input
  @hint("The reply panel view.")
  panel!: ReplyPanelUI

  @input
  @hint("The Gemini reply-draft service.")
  replyService!: OrbitReplyService

  @input
  @hint("Optional: the palm-up outbox menu, refreshed when a draft is sent.")
  @allowUndefined
  outboxMenu!: OutboxMenuUI

  @input
  @hint("PREVIEW ONLY — press R to open the reply flow on the most urgent card without flicking. Leave OFF for release.")
  debugReplyKey: boolean = false

  @input
  @hint("PREVIEW ONLY — with debugReplyKey on, also auto-open the reply flow 3s after start (for capture/verification). Leave OFF.")
  debugAutoOpen: boolean = false

  private dictation!: ReplyDictation
  private sfx!: AudioComponent

  private active = false
  private phase: ReplyPhase = "dictating"
  private msg: OrbitMessage | null = null
  private lastPartial = ""
  private lastIntent = ""
  private confirmTimer: DelayedCallbackEvent | null = null
  private sentTimer: DelayedCallbackEvent | null = null

  onAwake(): void {
    this.dictation = new ReplyDictation(this)
    this.sfx = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    this.sfx.volume = Math.min(1, OrbitConfig.sfxVolume * 2.2)
    this.sfx.playbackMode = Audio.PlaybackMode.LowLatency

    this.createEvent("OnStartEvent").bind(() => {
      if (!this.ring || !this.panel || !this.replyService) {
        print("ReplyFlowController: required @input not wired (ring / panel / replyService).")
        return
      }
      this.panel.onDone.add(() => this.onDone())
      this.panel.onSend.add(() => this.onSend())
      this.panel.onRedraft.add(() => this.onRedraft())
      this.panel.onEdit.add(() => this.onEdit())
      this.panel.onCancel.add(() => this.finish(false))

      if (this.debugReplyKey) {
        const openTop = () => {
          const top = MessageStore.getVisible()[0]
          if (top && !this.active) {
            print("[ReplyFlow][debug] opening reply on " + top.senderName)
            this.open(top)
          }
        }
        this.createEvent("KeyPressEvent").bind((e: KeyPressEvent) => {
          if (e.key === Keys.R) openTop()
        })
        if (this.debugAutoOpen) {
          const auto = this.createEvent("DelayedCallbackEvent")
          auto.bind(openTop)
          auto.reset(3.0)
        }
      }
    })
  }

  /**
   * LEAF seam: fire a panel action without a raycast onto the head-locked panel.
   * Routes to the exact handlers the panel buttons are wired to, so the state
   * machine (two-step send, cancel-unchanged, redraft) is what's under test.
   */
  testAction(a: "done" | "send" | "redraft" | "edit" | "cancel"): void {
    if (a === "done") this.onDone()
    else if (a === "send") this.onSend()
    else if (a === "redraft") this.onRedraft()
    else if (a === "edit") this.onEdit()
    else this.finish(false)
  }

  /** LEAF seam: current phase name. */
  testPhase(): string {
    return this.phase
  }

  /** Entry point — TriageController calls this on a committed DOWN flick. */
  open(msg: OrbitMessage): void {
    if (this.active) return
    this.active = true
    this.msg = msg
    this.lastPartial = ""
    this.lastIntent = ""

    this.ring.setBackgrounded(true)
    this.panel.open(msg)
    this.startDictation()
  }

  // ── Dictation ────────────────────────────────────────────────────────────
  private startDictation(): void {
    this.setPhase("dictating")
    this.panel.setListening()
    this.play(SFX_DICTATION_START)
    this.lastPartial = ""
    this.dictation.start(
      (partial: string) => {
        this.lastPartial = partial
        this.panel.setPartial(partial)
      },
      (r: DictationResult) => this.onIntent(r)
    )
  }

  private onDone(): void {
    if (this.phase !== "dictating") return
    this.dictation.finishNow(this.lastPartial)
  }

  private onRedraft(): void {
    if (!this.active) return
    this.clearTimers()
    this.startDictation()
  }

  private onIntent(r: DictationResult): void {
    if (!this.active || !this.msg) return
    this.lastIntent = r.text
    this.panel.setTranscript(r.text, r.simulated)
    this.setPhase("drafting")

    const t0 = getTime()
    this.replyService
      .draft(this.msg, r.text)
      .then((draft: string) => {
        if (!this.active) return
        const dt = getTime() - t0
        print("[ReplyFlow] draft round-trip " + dt.toFixed(2) + "s (" + OrbitConfig.aiDraftModel + ")")
        if (dt > 4) {
          print(
            "[ReplyFlow] draft > 4s — consider OrbitConfig.aiDraftModel = 'gemini-2.0-flash'"
          )
        }
        this.panel.setDraft(draft)
        this.setPhase("review")
        this.play(SFX_DRAFT_SETTLE)
      })
      .catch((e: any) => {
        if (!this.active) return
        print("[ReplyFlow] draft failed (" + e + ") — falling back to an editable stub")
        this.panel.setDraft(r.text)
        this.setPhase("review")
        this.play(SFX_DRAFT_SETTLE)
      })
  }

  // ── Edit (keyboard) ──────────────────────────────────────────────────────
  private onEdit(): void {
    if (this.phase !== "review" && this.phase !== "confirm") return
    this.clearTimers()
    this.setPhase("editing")
    try {
      require("LensStudio:TextInputModule")
      const options = new TextInputSystem.KeyboardOptions()
      options.enablePreview = true
      options.keyboardType = TextInputSystem.KeyboardType.Text
      options.returnKeyType = TextInputSystem.ReturnKeyType.Done
      options.initialText = this.panel.getDraft()
      options.onTextChanged = (text: string) => {
        this.panel.setDraft(text)
      }
      options.onReturnKeyPressed = () => {
        global.textInputSystem.dismissKeyboard()
        if (this.active) this.setPhase("review")
      }
      options.onKeyboardStateChanged = (isOpen: boolean) => {
        if (!isOpen && this.active && this.phase === "editing") this.setPhase("review")
      }
      global.textInputSystem.requestKeyboard(options)
    } catch (e) {
      print("[ReplyFlow] keyboard unavailable (" + e + ") — staying on the AI draft")
      this.setPhase("review")
    }
  }

  // ── Send (two-step) ──────────────────────────────────────────────────────
  private onSend(): void {
    if (!this.active || !this.msg) return

    if (this.phase !== "confirm") {
      this.setPhase("confirm")
      this.confirmTimer = this.createEvent("DelayedCallbackEvent")
      this.confirmTimer.bind(() => {
        if (this.active && this.phase === "confirm") this.setPhase("review")
      })
      this.confirmTimer.reset(OrbitConfig.sendConfirmSeconds)
      return
    }

    // Second press within the window → actually "send".
    this.clearTimers()
    OutboxStore.add({
      replyToId: this.msg.id,
      to: this.msg.senderName,
      source: this.msg.source,
      body: this.panel.getDraft(),
      sentAtMs: Date.now(),
    })
    if (this.outboxMenu) this.outboxMenu.refresh()
    this.play(SFX_SEND_CHIME)
    this.setPhase("sent")

    this.sentTimer = this.createEvent("DelayedCallbackEvent")
    this.sentTimer.bind(() => this.finish(true))
    this.sentTimer.reset(1.7)
  }

  // ── Teardown ─────────────────────────────────────────────────────────────
  private finish(archiveOriginal: boolean): void {
    if (!this.active) return
    this.active = false
    this.clearTimers()
    this.dictation.stop()
    try {
      global.textInputSystem.dismissKeyboard()
    } catch (e) {
      // ignore
    }

    const msg = this.msg
    this.msg = null
    this.ring.setBackgrounded(false)
    this.panel.close()

    if (archiveOriginal && msg) {
      MessageStore.archive(msg.id)
      this.ring.refill()
    }
  }

  private clearTimers(): void {
    if (this.confirmTimer) {
      this.confirmTimer.enabled = false
      this.confirmTimer = null
    }
    if (this.sentTimer) {
      this.sentTimer.enabled = false
      this.sentTimer = null
    }
  }

  private setPhase(p: ReplyPhase): void {
    this.phase = p
    this.panel.setPhase(p)
    print("[ReplyFlow] phase → " + p)
  }

  private play(track: AudioTrackAsset): void {
    if (!this.sfx) return
    this.sfx.audioTrack = track
    this.sfx.play(1)
  }
}
