/**
 * Orbit — LEAF test interactor (phase 4a).
 *
 * Shared actions used by more than one scenario: the directional card flick and
 * a plain button tap. Not a scene component.
 *
 * FLICK MECHANICS: LEAF's `drag(target, vec, ms)` adds `vec` to the drag point
 * once per `onDragUpdate` (≈ once per frame). The LEAF preview runs slow
 * (~12 fps here), so travel ≈ perFrameDelta × (durationMs × fps/1000) and the
 * sampled release speed ≈ perFrameDelta × fps. CardFlickController commits on
 * travel ≥ OrbitConfig.minTravelCm (12) AND sampled speed ≥
 * minReleaseSpeedCmPerSec (70). Values below are tuned with margin for the low,
 * variable preview framerate — Direct targeting keeps the motion axis-clean.
 *   commit  → delta 15 over 450 ms  (sampled speed ≥ 75 cm/s even at ~5 fps)
 *   too-slow → delta 1.0 over 1500 ms (past travel, well under the speed gate)
 */

import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { findInteractablesByName } from "Leaf.lspkg/Interactors/InteractableUtils"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { TargetingMode } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"

export type FlickDir = "left" | "right" | "up" | "down"

export class OrbitLeafInteractor extends DefaultLeafInteractor {
  constructor(name: string = "OrbitLeafInteractor") {
    super(name)
    // Direct targeting → InteractableManipulation translates the card by the raw
    // world-space drag delta (no far-ray stretch/offset), so flick direction and
    // travel are what CardFlickController actually samples.
    ;(this as any).targetingMode = TargetingMode.Direct
  }

  /** Flick a card. `commit=true` clears both thresholds; `false` is past travel but too slow. */
  async flickCard(cardName: string, dir: FlickDir, commit: boolean): Promise<void> {
    const card = findInteractablesByName(cardName, undefined, true)[0]
    if (!card) throw new Error(`card interactable "${cardName}" not found / not enabled`)

    const d = commit ? 15.0 : 1.0
    const durationMs = commit ? 450 : 1500
    const vec =
      dir === "right"
        ? new vec3(d, 0, 0)
        : dir === "left"
        ? new vec3(-d, 0, 0)
        : dir === "up"
        ? new vec3(0, d, 0)
        : new vec3(0, -d, 0)

    await this.drag(card, vec, durationMs)
    await sleep(450) // commit animation / spring-back settle
  }

  async tapButton(buttonName: string): Promise<void> {
    const btn = findInteractablesByName(buttonName, undefined, true)[0]
    if (!btn) throw new Error(`button "${buttonName}" not found / not enabled`)
    await this.trigger(btn)
    await sleep(150)
  }

  async tapInteractable(name: string): Promise<void> {
    return this.tapButton(name)
  }
}
