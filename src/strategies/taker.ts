import { BN } from "@project-serum/anchor";
import { Market, Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { Account, Connection, PublicKey } from '@solana/web3.js';

import { Position } from '../position';
import { Strategy } from './strategy';

import PARAMS from '../params/taker.json';

export class Taker extends Strategy {

  constructor(
    connection: Connection,
    account: Account,
    feeDiscountPubkey: PublicKey | null,
    positions: Position[],
    markets: Market[],
  ) {
    super(
      connection,
      account,
      feeDiscountPubkey,
      positions,
      markets,
    );
  }

  async update(marketIndex: number, asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]> {
    let newOrders: OrderParams[] = [];
    let staleOrders: Order[] = [];

    const p = Math.random();

    if (p < PARAMS.p) {

      const priceLevels = bids.getL2(1);

      if (priceLevels.length == 1) {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevels[0];
        newOrders.push({
          owner: this.account,
          payer: this.positions[marketIndex].baseTokenAccount,
          side: 'sell',
          price,
          size,
          orderType: 'limit',
          //clientId: undefined,
          openOrdersAddressKey: this.positions[marketIndex].openOrdersAccount,
          feeDiscountPubkey: this.feeDiscountPubkey,
          selfTradeBehavior: 'abortTransaction',
        });
      }

    } else if (p > (1 - PARAMS.p)) {

      const priceLevels = asks.getL2(1);

      if (priceLevels.length == 1) {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevels[0];
        newOrders.push({
          owner: this.account,
          payer: this.positions[marketIndex].quoteTokenAccount,
          side: 'buy',
          price,
          size,
          orderType: 'limit',
          //clientId: undefined,
          openOrdersAddressKey: this.positions[marketIndex].openOrdersAccount,
          feeDiscountPubkey: this.feeDiscountPubkey,
          selfTradeBehavior: 'abortTransaction',
        });
      }

    }

    return [newOrders, staleOrders];
  }

}
