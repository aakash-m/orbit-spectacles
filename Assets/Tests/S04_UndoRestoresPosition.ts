/**
 * S04 — Undo restores an archived card to its exact prior ring position.
 */
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { sleep } from "Leaf.lspkg/Utils/common/Utils"
import { MessageStore } from "../Scripts/MessageStore"
import { OrbitLeafInteractor } from "./OrbitLeafInteractor"

@component
export class S04_UndoRestoresPosition extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const interactor = new OrbitLeafInteractor()

    const before = MessageStore.getVisible().map((m) => m.id)
    const slot = 3
    const targetId = before[slot]
    expect(targetId).toBeTruthy()

    await interactor.flickCard("Card_03", "right", true)
    await sleep(400)
    expect(MessageStore.triageStatus(targetId)).toBe("archived")

    // Undo chip is up for OrbitConfig.undoSeconds (4 s) — tap it well within that.
    await interactor.tapButton("UndoChip")
    await sleep(600)

    // Restored, and back in the exact slot it left.
    expect(MessageStore.triageStatus(targetId)).toBe("active")
    const after = MessageStore.getVisible().map((m) => m.id)
    expect(after[slot]).toBe(targetId)
    expect(after.join(",")).toBe(before.join(","))
  }
}
