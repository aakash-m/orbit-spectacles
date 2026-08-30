/**
 * S10 — A 30° head turn does not re-centre the ring; a 50° turn held for 0.5 s
 * does.
 *
 * Uses OrbitRing.testHeadYawOverride so the check doesn't depend on driving the
 * device-tracked preview camera. The lazy-follow thresholds (45° / 0.5 s hold /
 * 0.6 s ease) are the phase-1 @input defaults on OrbitRig.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { getRing } from "./OrbitTestUtil"

const DEG = Math.PI / 180

@component
export class S10_LazyFollowRecentre extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const ring = getRing()
    const base = ring.getRingYaw()

    try {
      // 30° turn — under the 45° threshold: ring must not move.
      ring.testHeadYawOverride = base + 30 * DEG
      await sleep(900) // longer than the 0.5 s hold
      expect(Math.abs(ring.getRingYaw() - base) < 2 * DEG).toBe(true)

      // 50° turn held — past threshold and held past 0.5 s: ring re-centres toward it.
      ring.testHeadYawOverride = base + 50 * DEG
      await sleep(1400) // 0.5 s hold + 0.6 s ease + margin
      expect(Math.abs(ring.getRingYaw() - base) > 30 * DEG).toBe(true)
    } finally {
      ring.testHeadYawOverride = null
      await sleep(900) // let it settle back to the real head yaw
    }
  }
}
