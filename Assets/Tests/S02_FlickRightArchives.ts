/**
 * S02 — A rightward flick above both the travel and velocity thresholds
 * archives a card.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { MessageStore } from "../Scripts/MessageStore"
import { OrbitLeafInteractor } from "./OrbitLeafInteractor"
import { getRing } from "./OrbitTestUtil"

@component
export class S02_FlickRightArchives extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const interactor = new OrbitLeafInteractor()

    // Use a mid-ring card so this doesn't disturb the headline slot.
    const target = MessageStore.getVisible()[4]
    expect(target).toBeTruthy()
    expect(MessageStore.triageStatus(target.id)).toBe("active")

    await interactor.flickCard("Card_04", "right", true)
    await sleep(400)

    expect(MessageStore.triageStatus(target.id)).toBe("archived")

    // Cleanup so later scenarios see a full ring.
    MessageStore.restore(target.id)
    getRing().refill()
    await sleep(300)
  }
}
