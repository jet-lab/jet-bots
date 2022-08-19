import { BN } from '@project-serum/anchor';
import assert from 'assert';

//TODO load this from a package.
import {
  MarginAccount,
  Market,
  Order,
  SerumMarket,
} from '../../../bot-sdk/src/';

import { Bot } from './bot';

const PARAMS = {
  maxPosition: 1_000,
  minPosition: -1_000,
  takeProbability: 0.1,
};

export class Taker extends Bot {
  constructor(marginAccount: MarginAccount) {
    super(marginAccount);

    assert(
      marginAccount.configuration.cluster == 'devnet' ||
        marginAccount.configuration.cluster == 'localnet',
    );

    for (const market of Object.values<Market>(this.marginAccount.markets)) {
      this.marginAccount.setLimits(
        market.marketConfiguration.baseSymbol,
        PARAMS.minPosition,
        PARAMS.maxPosition,
      );
    }
  }

  async process(): Promise<void> {
    for (const market of Object.values<Market>(this.marginAccount.markets)) {
      const orders: Order[] = [];
      if (market instanceof SerumMarket) {
        const p = Math.random();
        if (p < PARAMS.takeProbability) {
          if (market.bids) {
            const priceLevels = market.bids.getL2(1);
            if (priceLevels.length == 1) {
              const [price, size, priceLots, sizeLots]: [
                number,
                number,
                BN,
                BN,
              ] = priceLevels[0];
              orders.push({
                market: 'serum',
                symbol: market.marketConfiguration.symbol,
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
              const [price, size, priceLots, sizeLots]: [
                number,
                number,
                BN,
                BN,
              ] = priceLevels[0];
              orders.push({
                market: 'serum',
                symbol: market.marketConfiguration.symbol,
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
}
