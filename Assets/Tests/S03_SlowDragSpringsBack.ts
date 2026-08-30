/**
 * S03 — A rightward movement past the travel threshold but BELOW the velocity
 * threshold does not archive: the card springs back and stays active.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { MessageStore } from "../Scripts/MessageStore"
import { OrbitLeafInteractor } from "./OrbitLeafInteractor"

@component
export class S03_SlowDragSpringsBack extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const interactor = new OrbitLeafInteractor()

    const target = MessageStore.getVisible()[4]
    expect(target).toBeTruthy()
    expect(MessageStore.triageStatus(target.id)).toBe("active")

    // Past travel (~25 cm) but slow (~48 cm/s, under the 70 cm/s gate).
    await interactor.flickCard("Card_04", "right", false)
    await sleep(500)

    // Still active — nothing was triaged.
    expect(MessageStore.triageStatus(target.id)).toBe("active")
    // Still the same message in that slot.
    expect(MessageStore.getVisible()[4].id).toBe(target.id)
  }
}
