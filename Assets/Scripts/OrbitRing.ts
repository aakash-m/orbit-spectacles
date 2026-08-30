/**
 * Orbit — OrbitRing.
 *
 * The ring orchestrator. Owns the 12 authored card SceneObjects, places them on
 * a 120°-wide, 70 cm-radius arc in 3 vertical tiers sorted by urgency, keeps the
 * ring body-anchored (not head-locked) with lazy-follow re-centring, billboards
 * each card to face the user, and drives the "+N more" counter chip.
 *
 * Runtime rotations are in radians. World units are centimetres.
 */

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import { OrbitCardUI, CardTheme } from "./OrbitCardUI"
import { OrbitCounterUI } from "./OrbitCounterUI"
import { OrbitEmptyStateUI } from "./OrbitEmptyStateUI"
import { OrbitMessage, parseIso } from "./OrbitTypes"
import { MessageStore } from "./MessageStore"
import { OrbitConfig } from "./OrbitConfig"

const DEG = Math.PI / 180

export interface ReflowReverse {
  reverseMsgId: string
  reverseFromLocal: vec3
}

/**
 * The 12 arc slots, in urgency priority order (slot 0 = most urgent).
 * Each is [yaw°, pitch°] relative to the ring's forward direction:
 * +yaw = right, +pitch = up. Slot 0 is dead centre at eye level; the rest
 * drift outward then downward through the tiers as urgency falls.
 */
const SLOTS: [number, number][] = [
  [0, -4], // tier 0 — eye level (a touch below horizon, matching resting gaze), dead centre
  [-30, -4],
  [30, -4],
  [-16, -19], // tier 1
  [16, -19],
  [-56, -4], // tier 0 — outer
  [56, -4],
  [-43, -19], // tier 1 — outer
  [43, -19],
  [0, -34], // tier 2 — the least urgent, tucked low
  [-29, -34],
  [29, -34],
]

@component
export class OrbitRing extends BaseScriptComponent {
  // ── Scene wiring ──────────────────────────────────────────────────────────
  @input
  @hint("Child SceneObject that carries the eased ring yaw. Cards are parented under it.")
  ringPivot!: SceneObject

  @input
  @hint("The 12 card SceneObjects' OrbitCardUI components, in slot order (any order — sorted by urgency at runtime).")
  cards!: OrbitCardUI[]

  @input
  @hint("The '+N more' counter chip.")
  counter!: OrbitCounterUI

  @input
  @hint("The calm completion state shown when the queue is exhausted.")
  @allowUndefined
  emptyState!: OrbitEmptyStateUI

  // ── Ring geometry ────────────────────────────────────────────────────────
  @ui.separator
  @input
  @hint("Arc radius from the user, in cm.")
  @widget(new SliderWidget(50, 100, 1))
  radius: number = 70

  // ── Reference time ───────────────────────────────────────────────────────
  @input
  @hint("Reference 'now' as ISO-8601 UTC — drives the relative-time labels. Defaults to just after the dataset's generation time.")
  nowIso: string = "2026-08-28T08:05:00Z"

  // ── Lazy-follow (body anchor) ────────────────────────────────────────────
  @ui.separator
  @input
  @hint("Head-turn past this many degrees (and held) before the ring re-centres.")
  @widget(new SliderWidget(20, 90, 1))
  recentreThresholdDeg: number = 45

  @input
  @hint("Seconds the head must stay past the threshold before the re-centre begins.")
  @widget(new SliderWidget(0.1, 2.0, 0.1))
  holdSeconds: number = 0.5

  @input
  @hint("Seconds the ring takes to ease into the new orientation.")
  @widget(new SliderWidget(0.2, 1.5, 0.1))
  easeSeconds: number = 0.6

  @input
  @hint("How quickly the ring's height tracks the user's (0 = frozen, 1 = instant). Keeps cards at eye level without head-bob.")
  @widget(new SliderWidget(0.02, 1.0, 0.01))
  verticalFollow: number = 0.08

  // ── Card theme (tunable opinions) ────────────────────────────────────────
  @ui.separator
  @ui.group_start("Card theme")
  @input
  @hint("Card surface fill. Low luminance for the additive display — a black fill would be invisible on device.")
  @widget(new ColorWidget())
  surfaceFill: vec4 = new vec4(0.13, 0.145, 0.17, 0.9)

  @input
  @hint("Card border colour — the bright edge that actually defines the card against the world.")
  @widget(new ColorWidget())
  borderColor: vec4 = new vec4(0.72, 0.74, 0.8, 0.9)

  @input
  @hint("Card border thickness in cm (~1.5 mm).")
  @widget(new SliderWidget(0.05, 0.4, 0.01))
  borderSize: number = 0.15

  @input
  @hint("Card corner radius in cm.")
  @widget(new SliderWidget(0.4, 3.0, 0.1))
  cornerRadius: number = 1.2
  @ui.group_end

  // ── Runtime state ────────────────────────────────────────────────────────
  private camTransform: Transform | null = null
  private ringYaw = 0
  private holdTimer = 0
  private easing = false
  private easeFrom = 0
  private easeTo = 0
  private easeTimer = 0

  private anchorMs = 0
  private cardTheme: Partial<CardTheme> = {}
  /** Phase 3: reply flow pushes the ring back + dims it while the panel is open. */
  private bgOffsetWorld = vec3.zero()
  private bgTargetWorld = vec3.zero()
  private backgrounded = false
  /** Which message each card slot currently shows (id), or null if the slot is empty. */
  private boundMsgId: (string | null)[] = []
  private lastTimeRefresh = 0
  private lastStoreTick = 0
  private emptyShown = false

  /**
   * LEAF seam only: when non-null, headYaw() returns this (radians) instead of
   * reading the camera, so a scenario can exercise the lazy-follow re-centre
   * without driving the device-tracked preview camera. Never set in production.
   */
  testHeadYawOverride: number | null = null

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Reference "now" in epoch ms — the phase-1 anchor advancing at 1× real time. */
  nowMs(): number {
    return this.anchorMs + getTime() * 1000
  }

  /** Current eased ring yaw in radians (LEAF reads this to check re-centring). */
  getRingYaw(): number {
    return this.ringYaw
  }

  /** The wired card components (TriageController walks these for their flick controllers). */
  getCards(): OrbitCardUI[] {
    return this.cards
  }

  /** Message currently bound to card slot `i`, or null. */
  boundMessage(i: number): OrbitMessage | null {
    const id = this.boundMsgId[i]
    return id ? MessageStore.byId(id) : null
  }

  /** Local (pivot-space) position of arc slot `i`. */
  slotLocalPos(i: number): vec3 {
    return this.slotDir(SLOTS[i][0], SLOTS[i][1]).uniformScale(this.radius)
  }

  private onStart(): void {
    if (!this.ringPivot || !this.cards || this.cards.length === 0 || !this.counter) {
      print("OrbitRing: required @input not wired (ringPivot / cards / counter). Check the bootstrap.")
      return
    }

    const cam = WorldCameraFinderProvider.getInstance()
    this.camTransform = cam.getTransform()

    this.ringYaw = this.headYaw()
    this.applyRingYaw()
    this.snapRigToUser(true)

    this.anchorMs = parseIso(this.nowIso)
    this.cardTheme = {
      surfaceFill: this.surfaceFill,
      borderColor: this.borderColor,
      borderSize: this.borderSize,
      cornerRadius: this.cornerRadius,
    }

    for (let i = 0; i < this.cards.length; i++) {
      this.cards[i].getSceneObject().setParent(this.ringPivot)
      this.cards[i].applyTheme(this.cardTheme)
      this.boundMsgId[i] = null
    }
    if (this.emptyState) this.emptyState.setVisible(false)

    // Initial fill: place each visible card directly at its slot (no animation).
    this.refill()
  }

  private onUpdate(): void {
    if (!this.camTransform) return
    const dt = getDeltaTime()

    this.updateBackgroundPush(dt)
    this.snapRigToUser(false)
    this.updateLazyFollow(dt)
    this.billboardCards()

    const now = getTime()
    if (now - this.lastStoreTick > 0.25) {
      this.lastStoreTick = now
      const woke = MessageStore.tick(now)
      if (woke.length > 0) this.refill()
    }
    if (now - this.lastTimeRefresh > 1.0) {
      this.lastTimeRefresh = now
      this.refreshTimes()
    }
  }

  // ── Fill / re-flow ───────────────────────────────────────────────────────
  /**
   * Rebind cards to the current `getVisible()` and animate the transition:
   * a message that moved slot slides from its old slot; a message new to the
   * visible set enters from the outer edge; on undo, the restored message
   * reverses in from where it left. Card `i` always occupies arc slot `i`.
   */
  /**
   * Re-sort the ring to the current urgency order with a slower, deliberate
   * reflow — used when a batch of AI urgencies arrives (spec: 800 ms, not a snap).
   */
  resort(reflowSeconds: number): void {
    this.refill(undefined, reflowSeconds)
  }

  refill(reverse?: ReflowReverse, reflowSeconds?: number): void {
    const nowMs = this.nowMs()
    const visible = MessageStore.getVisible()

    // Where each message sat before this refill.
    const oldSlotOf: { [id: string]: number } = {}
    for (let i = 0; i < this.boundMsgId.length; i++) {
      const id = this.boundMsgId[i]
      if (id) oldSlotOf[id] = i
    }
    const first = this.boundMsgId.every((x) => x === null)

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]
      if (i < visible.length && i < SLOTS.length) {
        const msg = visible[i]
        const slot = this.slotLocalPos(i)
        card.getSceneObject().enabled = true
        card.setMessage(msg, nowMs)

        if (first) {
          card.setLocalPos(slot)
        } else if (reverse && reverse.reverseMsgId === msg.id) {
          card.reverseTo(slot, reverse.reverseFromLocal)
        } else if (msg.id in oldSlotOf) {
          const from = oldSlotOf[msg.id]
          if (from === i) card.setLocalPos(slot)
          else card.reflowFromTo(this.slotLocalPos(from), slot, i, reflowSeconds)
        } else {
          // New to the visible set — enter from just beyond the outer slot.
          const outer = this.slotLocalPos(Math.min(SLOTS.length - 1, visible.length - 1))
          card.enterAt(slot, outer.add(outer.normalize().uniformScale(30)))
        }
        this.boundMsgId[i] = msg.id
      } else {
        card.getSceneObject().enabled = false
        this.boundMsgId[i] = null
      }
    }

    this.counter.setCount(MessageStore.overflowCount())
    this.updateEmptyState()
  }

  private refreshTimes(): void {
    const nowMs = this.nowMs()
    for (let i = 0; i < this.cards.length; i++) {
      const msg = this.boundMessage(i)
      if (msg) this.cards[i].refreshTime(msg, nowMs)
    }
  }

  private updateEmptyState(): void {
    if (!this.emptyState) return
    const exhausted = MessageStore.isExhausted()
    if (exhausted === this.emptyShown) return
    this.emptyShown = exhausted
    this.emptyState.setVisible(exhausted)
    this.counter.setCount(exhausted ? 0 : MessageStore.overflowCount())
  }

  // ── Body anchor ──────────────────────────────────────────────────────────
  /** Keep the rig at the user's position: X/Z instant (walking), Y damped (no bob). */
  private snapRigToUser(instant: boolean): void {
    const camPos = this.camTransform!.getWorldPosition()
    const t = this.sceneObject.getTransform()
    const cur = t.getWorldPosition()
    const y = instant ? camPos.y : cur.y + (camPos.y - cur.y) * Math.min(1, this.verticalFollow)
    const o = this.bgOffsetWorld
    t.setWorldPosition(new vec3(camPos.x + o.x, y + o.y, camPos.z + o.z))
  }

  // ── Phase 3: reply-flow background state ─────────────────────────────────
  /**
   * Push the ring away from the user and dim every card, so a reply panel in
   * front reads as the focus. Reversible: setBackgrounded(false) restores both.
   */
  setBackgrounded(on: boolean): void {
    if (on === this.backgrounded) return
    this.backgrounded = on
    if (on && this.camTransform) {
      // Away from the user along the head's horizontal forward, captured once.
      const look = this.camTransform.getWorldRotation().multiplyVec3(vec3.back())
      const fwd = new vec3(look.x, 0, look.z)
      const len = fwd.length
      const dir = len > 0.001 ? fwd.uniformScale(1 / len) : new vec3(0, 0, -1)
      this.bgTargetWorld = dir.uniformScale(-OrbitConfig.replyBackgroundPushCm)
    } else {
      this.bgTargetWorld = vec3.zero()
    }
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]
      if (!card.getSceneObject().enabled) continue
      card.fadeTo(on ? OrbitConfig.replyBackgroundAlpha : 1, 0.3)
    }
  }

  private updateBackgroundPush(dt: number): void {
    const cur = this.bgOffsetWorld
    const tgt = this.bgTargetWorld
    const k = Math.min(1, dt / 0.3)
    this.bgOffsetWorld = new vec3(
      cur.x + (tgt.x - cur.x) * k,
      cur.y + (tgt.y - cur.y) * k,
      cur.z + (tgt.z - cur.z) * k
    )
  }

  // ── Lazy-follow yaw ──────────────────────────────────────────────────────
  private updateLazyFollow(dt: number): void {
    const head = this.headYaw()
    const delta = Math.abs(this.shortestAngle(head - this.ringYaw))

    if (this.easing) {
      this.easeTimer += dt / Math.max(0.01, this.easeSeconds)
      const s = this.smoothstep(Math.min(1, this.easeTimer))
      this.ringYaw = this.easeFrom + this.shortestAngle(this.easeTo - this.easeFrom) * s
      if (this.easeTimer >= 1) {
        this.ringYaw = this.easeTo
        this.easing = false
        this.holdTimer = 0
      }
      this.applyRingYaw()
      return
    }

    if (delta > this.recentreThresholdDeg * DEG) {
      this.holdTimer += dt
      if (this.holdTimer >= this.holdSeconds) {
        this.easing = true
        this.easeTimer = 0
        this.easeFrom = this.ringYaw
        this.easeTo = head
      }
    } else {
      this.holdTimer = 0
    }
  }

  private applyRingYaw(): void {
    this.ringPivot
      .getTransform()
      .setWorldRotation(quat.fromEulerAngles(0, this.ringYaw, 0))
  }

  // ── Card placement & billboard ───────────────────────────────────────────
  /** Unit direction to an arc slot in pivot-local space (+yaw = right, +pitch = up). */
  private slotDir(yawDeg: number, pitchDeg: number): vec3 {
    const psi = yawDeg * DEG
    const theta = pitchDeg * DEG
    const cosT = Math.cos(theta)
    return new vec3(cosT * Math.sin(psi), Math.sin(theta), -cosT * Math.cos(psi))
  }

  /**
   * Face every visible card at the camera — yaw + pitch, upright (no roll).
   * `quat.lookAt(dir, up)` aligns the object's +Z with `dir`, and a card's
   * readable face is +Z, so `dir` is the card → camera direction.
   *
   * Cards well outside the view cone are skipped: their facing direction is
   * invisible, and the billboard is recomputed from scratch each frame, so a
   * card re-entering view is oriented correctly on the first frame it renders —
   * no pop, no stored state. This is the only per-frame work culled by view
   * angle; OrbitCardUI.tickVisual (the lag/tilt) is untouched and already
   * early-outs at rest.
   */
  private billboardCards(): void {
    const camPos = this.camTransform!.getWorldPosition()
    const camLook = this.camTransform!.getWorldRotation().multiplyVec3(vec3.back())
    for (let i = 0; i < this.cards.length; i++) {
      const obj = this.cards[i].getSceneObject()
      if (!obj.enabled) continue
      const t = obj.getTransform()
      const toCam = camPos.sub(t.getWorldPosition())
      const dist = toCam.length
      if (dist < 0.001) continue
      const fwd = toCam.uniformScale(1 / dist)
      // fwd points card→camera, so -fwd points camera→card. Skip when the card
      // sits more than ~70° off the camera's look axis (well beyond the ~63°
      // FOV) — it isn't on screen this frame.
      if (camLook.dot(fwd.uniformScale(-1)) < 0.33) continue
      let up = vec3.up()
      if (Math.abs(fwd.dot(up)) > 0.999) up = vec3.right()
      t.setWorldRotation(quat.lookAt(fwd, up))
    }
  }

  // ── Math helpers ─────────────────────────────────────────────────────────
  /**
   * World yaw of the camera's look direction, radians. 0 = looking along scene
   * -Z. Derived by rotating the scene-forward vector (0,0,-1) by the camera's
   * world rotation, which sidesteps the Transform.forward / vec3.forward sign
   * confusion (they disagree on which way is -Z).
   */
  private headYaw(): number {
    if (this.testHeadYawOverride !== null) return this.testHeadYawOverride
    const look = this.camTransform!.getWorldRotation().multiplyVec3(vec3.back())
    return Math.atan2(-look.x, -look.z)
  }

  /** Wrap an angle to (-π, π]. */
  private shortestAngle(a: number): number {
    let x = a
    while (x > Math.PI) x -= 2 * Math.PI
    while (x <= -Math.PI) x += 2 * Math.PI
    return x
  }

  private smoothstep(t: number): number {
    return t * t * (3 - 2 * t)
  }
}
