import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

import { Bot, Context, SerumMarket } from '../';

const PARAMS = {
  maxPosition: 1_000,
  minPosition: -1_000,
  takeProbability: 0.1,
};

export class Taker extends Bot {
  constructor(tradingContext: Context, marketDataContext: Context) {
    super(tradingContext, marketDataContext);

    for (const market of Object.values<SerumMarket>(
      this.tradingContext.markets,
    )) {
      if (this.tradingContext.marginAccount) {
        this.tradingContext.marginAccount.setLimits(
          market.marketConfig.baseSymbol,
          PARAMS.minPosition,
          PARAMS.maxPosition,
        );
      }
    }
  }

  process(): void {
    const orders: any[] = [];
    for (const market of Object.values<SerumMarket>(
      this.tradingContext.markets,
    )) {
      const p = Math.random();
      if (p < PARAMS.takeProbability) {
        if (market.bids) {
          const priceLevels = market.bids.getL2(1);

          if (priceLevels.length == 1) {
            const [price, size, priceLots, sizeLots]: [number, number, BN, BN] =
              priceLevels[0];
            orders.push({
              side: 'sell',
              price,
              size,
              orderType: 'limit',
              selfTradeBehavior: 'cancelProvide',
            });
          }
        }
      } else if (p > 1 - PARAMS.takeProbability) {
        if (market.asks) {
          const priceLevels = market.asks.getL2(1);
          if (priceLevels.length == 1) {
            const [price, size, priceLots, sizeLots]: [number, number, BN, BN] =
              priceLevels[0];
            orders.push({
              side: 'buy',
              price,
              size,
              orderType: 'limit',
              selfTradeBehavior: 'cancelProvide',
            });
          }
        }
      }
    }
    this.sendOrders(orders);
  }
}
