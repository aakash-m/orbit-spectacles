/**
 * Orbit — TriageController.
 *
 * The hub that turns a committed flick into an action. Wired once with the 12
 * flick controllers + cards, the ring, the undo chip and (optionally) the
 * archive-dissolve VFX instance.
 *
 *   LEFT  → snooze   card slides off left, returns after OrbitConfig.snoozeReturnSeconds
 *   RIGHT → archive   card dissolves (particle VFX)
 *   UP    → pin       card flies up + out, marked pinned, fires onCardPinned  (phase-6 seam)
 *   DOWN  → reply      logs + fires onReplyRequested, card springs back        (phase-3 seam)
 *
 * Every snooze / archive / pin shows a 4 s undo chip. One card may be grabbed
 * at a time.
 */

import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { CardFlickController } from "./CardFlickController"
import { OrbitCardUI, FlickDir } from "./OrbitCardUI"
import { OrbitRing } from "./OrbitRing"
import { OrbitUndoChipUI } from "./OrbitUndoChipUI"
import { OrbitConfig } from "./OrbitConfig"
import { MessageStore } from "./MessageStore"
import { OrbitMessage } from "./OrbitTypes"
import { ReplyFlowController } from "./ReplyFlowController"

type TriageKind = "snooze" | "archive" | "pin"

interface PendingUndo {
  msgId: string
  kind: TriageKind
  fromLocal: vec3
}

@component
export class TriageController extends BaseScriptComponent {
  @input
  ring!: OrbitRing

  @input
  undoChip!: OrbitUndoChipUI

  @input
  @hint("Optional: the pooled archive-dissolve VFX SceneObject. Moved to the card and re-triggered on archive.")
  @allowUndefined
  dissolveVfx!: SceneObject

  @input
  @hint("The phase-3 voice-reply flow. A DOWN flick opens it. If unwired, DOWN just springs the card back (phase-2 behaviour).")
  @allowUndefined
  replyFlow!: ReplyFlowController

  @input
  @hint("PREVIEW ONLY — press E to force-triage every remaining card straight to the empty state. Leave OFF for release.")
  debugForceEmptyKey: boolean = false

  private cards: OrbitCardUI[] = []
  private flicks: CardFlickController[] = []
  private pending: PendingUndo | null = null

  private _onCardPinned = new Event<OrbitMessage>()
  private _onReplyRequested = new Event<OrbitMessage>()
  /** Phase-6 seam: a card was pinned (wall placement lives here later). */
  get onCardPinned(): PublicApi<OrbitMessage> {
    return this._onCardPinned.publicApi()
  }
  /** Phase-3 seam: the user asked to reply to a message. */
  get onReplyRequested(): PublicApi<OrbitMessage> {
    return this._onReplyRequested.publicApi()
  }

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      if (!this.ring || !this.undoChip) {
        print("TriageController: required @input not wired (ring / undoChip).")
        return
      }
      this.cards = this.ring.getCards()
      for (let i = 0; i < this.cards.length; i++) {
        const flick = this.cards[i]
          .getSceneObject()
          .getComponent(CardFlickController.getTypeName()) as CardFlickController
        this.flicks.push(flick)
        if (!flick) continue
        const idx = i
        flick.onGrabStart.add(() => this.lockOthers(idx))
        flick.onGrabEnd.add(() => this.unlockAll())
        flick.onCommit.add((dir: FlickDir) => this.commit(idx, dir))
      }

      if (this.debugForceEmptyKey) {
        this.createEvent("KeyPressEvent").bind((e: KeyPressEvent) => {
          if (e.key === Keys.E) this.debugForceEmpty()
        })
      }
    })

    if (this.dissolveVfx) this.dissolveVfx.enabled = false
  }

  // ── One-grab-at-a-time lock ──────────────────────────────────────────────
  private lockOthers(grabbedIndex: number): void {
    for (let i = 0; i < this.flicks.length; i++) {
      if (i !== grabbedIndex) this.flicks[i].setGrabEnabled(false)
    }
  }

  private unlockAll(): void {
    for (let i = 0; i < this.flicks.length; i++) this.flicks[i].setGrabEnabled(true)
  }

  // ── Commit routing ───────────────────────────────────────────────────────
  private commit(cardIndex: number, dir: FlickDir): void {
    const msg = this.ring.boundMessage(cardIndex)
    const card = this.cards[cardIndex]
    if (!msg) {
      card.settle(this.ring.slotLocalPos(cardIndex))
      return
    }
    const slot = this.ring.slotLocalPos(cardIndex)
    card.playSfx(("whoosh-" + dir) as any)

    if (dir === "down") {
      // Phase 3: the card springs back to its slot and the reply flow takes over
      // in a panel in front of the (pushed-back, dimmed) ring. The card is only
      // removed from the ring if a reply is actually sent.
      this._onReplyRequested.invoke(msg)
      card.springBack(slot)
      if (this.replyFlow) {
        this.replyFlow.open(msg)
      } else {
        console.log("[Orbit] reply intent (no replyFlow wired): " + msg.id + " (" + msg.senderName + ")")
      }
      return
    }

    // Any new destructive action finalises a still-pending undo.
    this.finalizePending()

    if (dir === "left") {
      MessageStore.snooze(msg.id, getTime())
      const exit = slot.add(new vec3(-55, 0, 0))
      card.commitSlide(new vec3(-1, 0, 0), slot, () =>
        this.afterCommit(msg.id, "snooze", exit)
      )
    } else if (dir === "right") {
      MessageStore.archive(msg.id)
      this.spawnDissolve(cardIndex)
      card.playSfx("dissolve")
      card.commitDissolve(() => this.afterCommit(msg.id, "archive", slot))
    } else {
      // up
      MessageStore.pin(msg.id)
      this._onCardPinned.invoke(msg)
      const exit = slot.add(new vec3(0, 45, 12))
      card.commitFlyUp(slot, () => this.afterCommit(msg.id, "pin", exit))
    }
  }

  private afterCommit(msgId: string, kind: TriageKind, fromLocal: vec3): void {
    this.ring.refill()
    this.pending = { msgId, kind, fromLocal }
    const label =
      kind === "snooze" ? "snooze · " + OrbitConfig.snoozeLabel : kind === "archive" ? "archive" : "pin"
    this.undoChip.show(OrbitConfig.undoSeconds, label, () => this.doUndo())
  }

  private doUndo(): void {
    const p = this.pending
    if (!p) return
    this.pending = null
    MessageStore.restore(p.msgId)
    this.undoChip.playTone()
    this.ring.refill({ reverseMsgId: p.msgId, reverseFromLocal: p.fromLocal })
  }

  /** The pending action is now permanent. */
  private finalizePending(): void {
    this.pending = null
    this.undoChip.finishSilently()
  }

  // ── Archive VFX ──────────────────────────────────────────────────────────
  private spawnDissolve(cardIndex: number): void {
    if (!this.dissolveVfx) return
    const cardObj = this.cards[cardIndex].getSceneObject()
    const p = cardObj.getTransform().getWorldPosition()
    this.dissolveVfx.getTransform().setWorldPosition(p)
    // Re-trigger by toggling the VFX component off/on.
    this.dissolveVfx.enabled = false
    this.dissolveVfx.enabled = true
    const vfx = this.dissolveVfx
    const off = this.createEvent("DelayedCallbackEvent")
    off.bind(() => {
      vfx.enabled = false
    })
    off.reset(OrbitConfig.archiveDissolveSeconds + 0.3)
  }

  // ── Debug (preview only) ─────────────────────────────────────────────────
  /**
   * Force-triage every remaining card so the empty state can be reached without
   * 24 manual flicks. Archives all active + snoozed messages, then refills.
   * Only wired when the `debugForceEmptyKey` input is ON — leave it OFF for release.
   */
  private debugForceEmpty(): void {
    for (const m of MessageStore.getAll()) {
      const s = MessageStore.triageStatus(m.id)
      if (s === "active" || s === "snoozed") MessageStore.archive(m.id)
    }
    this.finalizePending()
    this.ring.refill()
    print("[Orbit][debug] force-triaged all remaining cards → empty state")
  }
}
