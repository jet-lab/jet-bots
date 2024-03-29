import { Market, Order, Protocol, SerumMarket } from '@jet-lab/bot-sdk';
import { BN } from '@project-serum/anchor';
import assert from 'assert';

import { Bot } from './bot';

const PARAMS = {
  maxOrderAmount: 100,
  maxPositionAmount: 1_000,
  minOrderInterval: 1,
  minPositionAmount: -1_000,
  takeProbability: 0.1,
};

export class Taker extends Bot {
  constructor(protocol: Protocol) {
    super(protocol);

    assert(
      protocol.configuration.cluster == 'devnet' ||
        protocol.configuration.cluster == 'localnet',
    );

    for (const market of Object.values<Market>(this.protocol.markets)) {
      this.protocol.setLimits({
        symbol: market.marketConfiguration.baseSymbol,
        maxOrderAmount: PARAMS.maxOrderAmount,
        maxPositionAmount: PARAMS.maxPositionAmount,
        minOrderInterval: PARAMS.minOrderInterval,
        minPositionAmount: PARAMS.minPositionAmount,
      });
    }
  }

  async process(): Promise<void> {
    for (const market of Object.values<Market>(this.protocol.markets)) {
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
                dex: 'serum',
                symbol: market.marketConfiguration.symbol,
                side: 'sell',
                price,
                size: PARAMS.maxOrderAmount / price,
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
                dex: 'serum',
                symbol: market.marketConfiguration.symbol,
                side: 'buy',
                price,
                size: PARAMS.maxOrderAmount / price,
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
