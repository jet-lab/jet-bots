import { BN } from "@project-serum/anchor";
import { Market, Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { Account, Connection } from '@solana/web3.js';

import { Position } from '../position';
import { Strategy } from './strategy';

import PARAMS from '../params/maker.json';

export class Maker extends Strategy {

  mainnetConnection: Connection;
  mainnetMarkets: Market[];

  constructor(
    connection: Connection,
    account: Account,
    positions: Position[],
    markets: Market[],
    mainnetConnection: Connection,
    mainnetMarkets: Market[],
  ) {
    super(
      connection,
      account,
      positions,
      markets,
    );
    this.mainnetConnection = mainnetConnection;
    this.mainnetMarkets = mainnetMarkets;
  }

  async update(marketIndex: number, asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]> {
    let newOrders: OrderParams[] = [];
    let staleOrders: Order[] = [];

    const depth = PARAMS.depth;

    const [ mainnetAsk, mainnetBid ] = await Promise.all([
      await this.mainnetMarkets[marketIndex].loadAsks(this.mainnetConnection),
      await this.mainnetMarkets[marketIndex].loadBids(this.mainnetConnection),
    ]);

    const mainnetAskPriceLevels = mainnetAsk.getL2(depth);
    const mainnetBidPriceLevels = mainnetBid.getL2(depth);

    if (openOrders.length == 0) {

      mainnetAskPriceLevels.forEach((priceLevel) => {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
        newOrders.push({
          owner: this.account,
          payer: this.positions[marketIndex].baseTokenAccount,
          side: 'sell',
          price,
          size,
          orderType: 'limit',
          //clientId: undefined,
          openOrdersAddressKey: this.positions[marketIndex].openOrdersAccount,
          feeDiscountPubkey: null,
          selfTradeBehavior: 'abortTransaction',
        });
      });

      mainnetBidPriceLevels.forEach((priceLevel) => {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
        newOrders.push({
          owner: this.account,
          payer: this.positions[marketIndex].quoteTokenAccount,
          side: 'buy',
          price,
          size,
          orderType: 'limit',
          //clientId: undefined,
          openOrdersAddressKey: this.positions[marketIndex].openOrdersAccount,
          feeDiscountPubkey: null,
          selfTradeBehavior: 'abortTransaction',
        });
      });

    } else {
      mainnetAskPriceLevels.forEach((priceLevel) => {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
        /*
        const order = openOrders.find((order) => { return order.priceLots.eq(priceLots); });
        if (!order) {
          newOrders.push({
            owner: this.account,
            payer: this.positions[marketIndex].baseTokenAccount,
            side: 'sell',
            price,
            size,
            orderType: 'limit',
            //clientId: undefined,
            openOrdersAddressKey: this.positions[marketIndex].openOrdersAccount,
            feeDiscountPubkey: null,
            selfTradeBehavior: 'abortTransaction',
          });
        }
        */
      });

      /*
      openOrders.forEach((order) => {
        if (order.side == 'sell') {
          const priceLevel = mainnetAskPriceLevels.find((priceLevel) => {
            const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
            return priceLots.eq(order.priceLots);
          });
          if (!priceLevel) {
            staleOrders.push(order);
          }
        }
      });
      */

      mainnetBidPriceLevels.forEach((priceLevel) => {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
        /*
        const order = openOrders.find((order) => { return order.priceLots.eq(priceLots); });
        if (!order) {
          newOrders.push({
            owner: this.account,
            payer: this.positions[marketIndex].quoteTokenAccount,
            side: 'buy',
            price,
            size,
            orderType: 'limit',
            //clientId: undefined,
            openOrdersAddressKey: this.positions[marketIndex].openOrdersAccount,
            feeDiscountPubkey: null,
            selfTradeBehavior: 'abortTransaction',
          });
        }
        */
      });

      /*
      openOrders.forEach((order) => {
        if (order.side == 'buy') {
          const priceLevel = mainnetBidPriceLevels.find((priceLevel) => {
            const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
            return priceLots.eq(order.priceLots);
          });
          if (!priceLevel) {
            staleOrders.push(order);
          }
        }
      });
      */
    }

    return [newOrders, staleOrders];
  }

}
