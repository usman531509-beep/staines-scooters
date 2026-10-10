import { describe, it, expect } from "vitest";
import { stockCountImpact, profitWithStockCounts } from "./stock-accounting";

describe("stock count financial exclusion", () => {
  it("checked corrections change physical stock value but not financial statements", () => {
    expect(stockCountImpact(-2, 1250, true)).toEqual({ physicalValueDeltaPence: -2500, inventoryDeltaPence: 0, profitDeltaPence: 0, cashDeltaPence: 0 });
  });
  it("unchecked shortage reduces inventory assets and profit at batch cost", () => {
    expect(stockCountImpact(-2, 1250, false)).toEqual({ physicalValueDeltaPence: -2500, inventoryDeltaPence: -2500, profitDeltaPence: -2500, cashDeltaPence: 0 });
    expect(profitWithStockCounts(10000, 4000, 0, 500, -2500)).toEqual({ cogsPence: 6500, grossProfitPence: 3500, netProfitPence: 3000 });
  });
  it("unchecked surplus increases inventory and profit without inventing cash receipts", () => {
    expect(stockCountImpact(2, 1250, false)).toEqual({ physicalValueDeltaPence: 2500, inventoryDeltaPence: 2500, profitDeltaPence: 2500, cashDeltaPence: 0 });
  });
});