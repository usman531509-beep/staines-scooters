import { describe, expect, it } from "vitest";
import { earlySettlement } from "./finance-calc";

const due = [{ dueDate: "2027-10-08", pence: 27790 }, { dueDate: "2027-11-08", pence: 27790 }];
describe("finance interest rebate switch", () => {
  it("defaults off and requires the full scheduled balance", () => {
    expect(earlySettlement(due, 22, "2026-10-08")).toMatchObject({ rebatePence: 0, figurePence: 55580, grossPence: 55580 });
  });
  it("does not discount any payment when explicitly deactivated", () => {
    expect(earlySettlement(due, 22, "2026-10-08", false)).toMatchObject({ rebatePence: 0, figurePence: 55580 });
  });
  it("applies the existing actuarial rebate only when activated", () => {
    const result = earlySettlement(due, 22, "2026-10-08", true);
    expect(result.rebatePence).toBeGreaterThan(0);
    expect(result.figurePence + result.rebatePence).toBe(55580);
  });
});