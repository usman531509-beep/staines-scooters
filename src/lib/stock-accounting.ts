export function stockCountImpact(quantityDelta: number, unitCostPence: number, excluded: boolean) {
  const physicalValueDeltaPence = Math.round(quantityDelta * unitCostPence);
  return {
    physicalValueDeltaPence,
    inventoryDeltaPence: excluded ? 0 : physicalValueDeltaPence,
    profitDeltaPence: excluded ? 0 : physicalValueDeltaPence,
    cashDeltaPence: 0,
  };
}

export function profitWithStockCounts(netSalesPence: number, goodsCostPence: number, lostDamagedPence: number, expensesPence: number, stockProfitPence: number) {
  const cogsPence = goodsCostPence + lostDamagedPence - stockProfitPence;
  return { cogsPence, grossProfitPence: netSalesPence - cogsPence, netProfitPence: netSalesPence - cogsPence - expensesPence };
}