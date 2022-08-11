import { BN } from '@project-serum/anchor';

import { Bot, Context, SerumMarket } from '../';

const PARAMS = {
  p: 0.1,
};

export class Taker extends Bot {
  constructor(tradingContext: Context, marketDataContext: Context) {
    super(tradingContext, marketDataContext);
  }

  process(): void {
    const orders: any[] = [];
    for (const market of Object.values<SerumMarket>(
      this.tradingContext.markets,
    )) {
      const p = Math.random();
      if (p < PARAMS.p) {
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
      } else if (p > 1 - PARAMS.p) {
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
