import { BN } from '@project-serum/anchor';
import { Market, Orderbook } from '@project-serum/serum';
import { Order, OrderParams } from '@project-serum/serum/lib/market';
import { Account, Connection, PublicKey } from '@solana/web3.js';
import assert from 'assert';

import { Bot, Context, PythOracle, SerumMarket } from '../';

const PARAMS = {
  p: 0.1,
};

export class Taker extends Bot {
  constructor(tradingContext: Context, marketDataContext: Context) {
    super(tradingContext, marketDataContext);
  }

  process(): void {}

  //async update(symbol: string, asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]> {
  async update(
    symbol: string,
    asks: Orderbook,
    bids: Orderbook,
  ): Promise<[OrderParams[], Order[]]> {
    const newOrders: OrderParams[] = [];
    const staleOrders: Order[] = [];

    /*
    assert(this.tradingContext.positions[symbol]);
    */

    const p = Math.random();

    if (p < PARAMS.p) {
      const priceLevels = bids.getL2(1);

      if (priceLevels.length == 1) {
        const [price, size, priceLots, sizeLots]: [number, number, BN, BN] =
          priceLevels[0];
        /*
        newOrders.push({
          owner: this.context.account,
          payer: this.context.positions[symbol].baseTokenAccount,
          side: 'sell',
          price,
          size,
          orderType: 'limit',
          //clientId: undefined,
          openOrdersAddressKey: this.context.positions[symbol].openOrdersAccount,
          feeDiscountPubkey: this.feeDiscountPubkey,
          selfTradeBehavior: 'abortTransaction',
        });
          */
      }
    } else if (p > 1 - PARAMS.p) {
      const priceLevels = asks.getL2(1);

      if (priceLevels.length == 1) {
        const [price, size, priceLots, sizeLots]: [number, number, BN, BN] =
          priceLevels[0];
        /*
        newOrders.push({
          owner: this.account,
          payer: this.context.positions[symbol].quoteTokenAccount,
          side: 'buy',
          price,
          size,
          orderType: 'limit',
          //clientId: undefined,
          openOrdersAddressKey: this.context.positions[symbol].openOrdersAccount,
          feeDiscountPubkey: this.feeDiscountPubkey,
          selfTradeBehavior: 'abortTransaction',
        });
          */
      }
    }

    return [newOrders, staleOrders];
  }
}
