/**
 * Orbit — CardFlickController.
 *
 * One per card. Adds the pinch-grab + directional-flick gesture on top of
 * OrbitCardUI. Built on SIK `Interactable` + `InteractableManipulation`
 * (translate-only): the manipulation glues the card root to the hand / mouse /
 * preview-puppet, and this script reads the root's world position each frame to
 * drive the affordances, thresholds, and direction classification — one code
 * path for device, editor, and `PreviewInteractTool`.
 *
 * Commit rule (see 02-flick-triage.md + OrbitConfig):
 *   travel ≥ minTravelCm AND releaseSpeed ≥ minReleaseSpeedCmPerSec → commit
 *   travel ≥ minTravelCm but too slow                              → spring back
 *   below either                                                    → soft settle
 *
 * Aborts (settle / spring) are handled here. A commit is emitted to
 * TriageController via `onCommit`.
 */

import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { OrbitCardUI, FlickDir } from "./OrbitCardUI"
import { OrbitConfig } from "./OrbitConfig"

const CARD_W = 22
const CARD_H = 14
const VELOCITY_WINDOW_SEC = 0.12

interface Sample {
  p: vec3
  t: number
}

@component
export class CardFlickController extends BaseScriptComponent {
  private card!: OrbitCardUI
  private interactable!: Interactable
  private manipulation!: InteractableManipulation
  private cam: Transform | null = null

  private grabbed = false
  private grabEnabled = true
  private originWorld = vec3.zero()
  private originLocal = vec3.zero()
  private planeRight = vec3.right()
  private planeUp = vec3.up()
  private samples: Sample[] = []

  private _onGrabStart = new Event<void>()
  private _onGrabEnd = new Event<void>()
  private _onCommit = new Event<FlickDir>()
  get onGrabStart(): PublicApi<void> {
    return this._onGrabStart.publicApi()
  }
  get onGrabEnd(): PublicApi<void> {
    return this._onGrabEnd.publicApi()
  }
  get onCommit(): PublicApi<FlickDir> {
    return this._onCommit.publicApi()
  }

  onAwake(): void {
    this.card = this.sceneObject.getComponent(OrbitCardUI.getTypeName()) as OrbitCardUI

    const collider = this.sceneObject.createComponent("Physics.ColliderComponent")
    const shape = Shape.createBoxShape()
    shape.size = new vec3(CARD_W + 4, CARD_H + 4, 4)
    collider.shape = shape
    ;(collider as any).debugDrawEnabled = false

    this.interactable = this.sceneObject.createComponent(
      Interactable.getTypeName()
    ) as Interactable
    this.interactable.targetingMode = 1 // Direct — reach out and grab the card

    this.manipulation = this.sceneObject.createComponent(
      InteractableManipulation.getTypeName()
    ) as InteractableManipulation
    this.manipulation.setCanRotate(false)
    this.manipulation.setCanScale(false)
    this.manipulation.setCanTranslate(true)

    this.createEvent("OnStartEvent").bind(() => {
      this.cam = WorldCameraFinderProvider.getInstance().getTransform()
      this.manipulation.onManipulationStart.add(() => this.begin())
      this.manipulation.onManipulationEnd.add(() => this.end())
    })

    this.createEvent("UpdateEvent").bind(() => {
      if (this.grabbed) this.sample()
    })
  }

  /** TriageController disables every other card's grab while one is held. */
  setGrabEnabled(enabled: boolean): void {
    this.grabEnabled = enabled
    if (!this.grabbed) this.interactable.enabled = enabled
  }

  // ── Gesture lifecycle ────────────────────────────────────────────────────
  private begin(): void {
    if (!this.grabEnabled || this.grabbed) return
    this.grabbed = true
    const t = this.sceneObject.getTransform()
    this.originWorld = t.getWorldPosition()
    this.originLocal = t.getLocalPosition()
    if (this.cam) {
      this.planeRight = this.cam.right
      this.planeUp = this.cam.up
    }
    this.samples = [{ p: this.originWorld, t: getTime() }]
    this.card.onGrabStart()
    this.card.showAffordances()
    this._onGrabStart.invoke()
  }

  private sample(): void {
    const p = this.sceneObject.getTransform().getWorldPosition()
    this.samples.push({ p, t: getTime() })
    while (this.samples.length > 8) this.samples.shift()
    this.card.updateAffordances(this.planarTravel(p))
  }

  private end(): void {
    if (!this.grabbed) return
    this.grabbed = false
    this.card.onGrabEnd()
    this.card.hideAffordances()
    this._onGrabEnd.invoke()

    const p = this.sceneObject.getTransform().getWorldPosition()
    const planar = this.planarTravel(p)
    const travelDist = planar.length
    const speed = this.releaseSpeed()

    if (OrbitConfig.flickDebug) {
      const w = p.sub(this.originWorld)
      print(
        "[flick] world d=(" + w.x.toFixed(1) + "," + w.y.toFixed(1) + "," + w.z.toFixed(1) +
          ") planar=(" + planar.x.toFixed(1) + "," + planar.y.toFixed(1) +
          ") travel=" + travelDist.toFixed(1) + " speed=" + speed.toFixed(0) +
          " right=(" + this.planeRight.x.toFixed(2) + "," + this.planeRight.y.toFixed(2) + "," + this.planeRight.z.toFixed(2) +
          ") up=(" + this.planeUp.x.toFixed(2) + "," + this.planeUp.y.toFixed(2) + "," + this.planeUp.z.toFixed(2) + ")"
      )
    }

    if (
      travelDist >= OrbitConfig.minTravelCm &&
      speed >= OrbitConfig.minReleaseSpeedCmPerSec
    ) {
      const dir = this.classify(planar)
      if (dir) {
        this._onCommit.invoke(dir)
        return
      }
    }

    if (travelDist >= OrbitConfig.minTravelCm) {
      this.card.springBack(this.originLocal)
    } else {
      this.card.settle(this.originLocal)
    }
  }

  // ── Math ─────────────────────────────────────────────────────────────────
  private planarTravel(p: vec3): vec2 {
    const travel = p.sub(this.originWorld)
    return new vec2(travel.dot(this.planeRight), travel.dot(this.planeUp))
  }

  /** Speed over the last ~120 ms, cm/s, full 3D (a fast flick in any direction). */
  private releaseSpeed(): number {
    const n = this.samples.length
    if (n < 2) return 0
    const last = this.samples[n - 1]
    let earlier = this.samples[0]
    for (let i = n - 2; i >= 0; i--) {
      earlier = this.samples[i]
      if (last.t - earlier.t >= VELOCITY_WINDOW_SEC) break
    }
    const dt = last.t - earlier.t
    if (dt <= 0) return 0
    return last.p.sub(earlier.p).length / dt
  }

  private classify(planar: vec2): FlickDir | null {
    const ax = Math.abs(planar.x)
    const ay = Math.abs(planar.y)
    const s = OrbitConfig.directionStrictness
    if (ax >= ay * s) return planar.x > 0 ? "right" : "left"
    if (ay >= ax * s) return planar.y > 0 ? "up" : "down"
    return null // diagonal — reject
  }
}
