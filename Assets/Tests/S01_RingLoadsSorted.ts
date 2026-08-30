/**
 * S01 — The mock dataset loads and renders 12 cards sorted by urgency descending.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { MessageStore, MAX_VISIBLE } from "../Scripts/MessageStore"
import { isEnabled } from "./OrbitTestUtil"

@component
export class S01_RingLoadsSorted extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)

    const all = MessageStore.getAll()
    expect(all.length).toBe(24)

    const visible = MessageStore.getVisible()
    const activeCount = all.filter((m) => MessageStore.triageStatus(m.id) === "active").length
    const expectedVisible = Math.min(MAX_VISIBLE, activeCount)
    expect(visible.length).toBe(expectedVisible)

    // Sorted by urgency descending.
    for (let i = 0; i < visible.length - 1; i++) {
      expect(visible[i].urgency >= visible[i + 1].urgency).toBe(true)
    }

    // The corresponding card SceneObjects are enabled.
    for (let i = 0; i < visible.length; i++) {
      const name = "Card_" + (i < 10 ? "0" + i : "" + i)
      expect(isEnabled(name)).toBe(true)
    }
  }
}
