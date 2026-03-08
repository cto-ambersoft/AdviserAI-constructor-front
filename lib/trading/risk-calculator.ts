export type TradeParams = {
  riskUsd: number;
  entryPrice: number;
  stopLoss: number;
  feePercent: number;
  rrRatio?: number;
};

export type TradeResult = {
  meta: {
    direction: "LONG" | "SHORT";
    inputRR: number;
  };
  position: {
    sizeCoins: number;
    sizeUsdt: number;
  };
  scenarios: {
    stopLoss: {
      price: number;
      entryFee: number;
      exitFee: number;
      totalFees: number;
      priceLoss: number;
      totalLoss: number;
    };
    takeProfit: {
      price: number;
      entryFee: number;
      exitFee: number;
      grossProfit: number;
      netProfit: number;
      realRR: number;
    };
  };
};

export function calculatePosition(params: TradeParams): TradeResult {
  const { riskUsd, entryPrice, stopLoss, feePercent } = params;
  const rrRatio = params.rrRatio ?? 3;

  if (!Number.isFinite(riskUsd) || riskUsd <= 0) {
    throw new Error("Risk must be greater than 0.");
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    throw new Error("Entry price must be greater than 0.");
  }
  if (!Number.isFinite(stopLoss) || stopLoss <= 0) {
    throw new Error("Stop-loss price must be greater than 0.");
  }
  if (!Number.isFinite(feePercent) || feePercent < 0) {
    throw new Error("Fee percent must be 0 or greater.");
  }
  if (!Number.isFinite(rrRatio) || rrRatio <= 0) {
    throw new Error("RR ratio must be greater than 0.");
  }

  if (entryPrice === stopLoss) {
    throw new Error("Entry price cannot be equal to stop-loss price.");
  }

  const feeRate = feePercent / 100;
  const priceDelta = Math.abs(entryPrice - stopLoss);

  // Risk = (Delta * Size) + (EntryPrice * Size * Fee) + (StopPrice * Size * Fee)
  const denominator = priceDelta + feeRate * (entryPrice + stopLoss);
  if (denominator <= 0) {
    throw new Error("Invalid parameters: denominator must be > 0.");
  }

  const positionSizeCoins = riskUsd / denominator;
  const positionSizeUsdt = positionSizeCoins * entryPrice;

  const direction = entryPrice < stopLoss ? "SHORT" : "LONG";

  const entryFee = positionSizeCoins * entryPrice * feeRate;
  const stopFee = positionSizeCoins * stopLoss * feeRate;

  const profitDistance = priceDelta * rrRatio;
  const tpPrice = direction === "LONG" ? entryPrice + profitDistance : entryPrice - profitDistance;

  const tpFee = positionSizeCoins * tpPrice * feeRate;
  const grossProfit = profitDistance * positionSizeCoins;
  const totalFeeInProfit = entryFee + tpFee;
  const netProfit = grossProfit - totalFeeInProfit;
  const realRR = netProfit / riskUsd;

  return {
    meta: { direction, inputRR: rrRatio },
    position: { sizeCoins: positionSizeCoins, sizeUsdt: positionSizeUsdt },
    scenarios: {
      stopLoss: {
        price: stopLoss,
        entryFee,
        exitFee: stopFee,
        totalFees: entryFee + stopFee,
        priceLoss: priceDelta * positionSizeCoins,
        totalLoss: priceDelta * positionSizeCoins + (entryFee + stopFee),
      },
      takeProfit: {
        price: tpPrice,
        entryFee,
        exitFee: tpFee,
        grossProfit,
        netProfit,
        realRR,
      },
    },
  };
}
