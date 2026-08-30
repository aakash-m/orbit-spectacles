/**
 * S09 — After archiving a card, no gap remains and a queued message appears.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { MessageStore, MAX_VISIBLE } from "../Scripts/MessageStore"
import { OrbitLeafInteractor } from "./OrbitLeafInteractor"
import { isEnabled, getRing } from "./OrbitTestUtil"

@component
export class S09_RefillNoGap extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const interactor = new OrbitLeafInteractor()

    expect(MessageStore.overflowCount() > 0).toBe(true) // there is a queue to pull from
    const beforeIds = MessageStore.getVisible().map((m) => m.id)
    expect(beforeIds.length).toBe(MAX_VISIBLE)
    const archivedId = beforeIds[6]

    await interactor.flickCard("Card_06", "right", true)
    await sleep(500)

    const afterIds = MessageStore.getVisible().map((m) => m.id)

    // Still full — no gap.
    expect(afterIds.length).toBe(MAX_VISIBLE)
    for (let i = 0; i < MAX_VISIBLE; i++) {
      const name = "Card_" + (i < 10 ? "0" + i : "" + i)
      expect(isEnabled(name)).toBe(true)
    }

    // The archived one is gone; exactly one message that wasn't visible before now is.
    expect(afterIds.indexOf(archivedId)).toBe(-1)
    const promoted = afterIds.filter((id) => beforeIds.indexOf(id) === -1)
    expect(promoted.length).toBe(1)

    // Cleanup.
    MessageStore.restore(archivedId)
    getRing().refill()
    await sleep(300)
  }
}
