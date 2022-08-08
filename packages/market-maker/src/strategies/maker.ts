import { BN } from '@project-serum/anchor';
import { Market, Orderbook } from '@project-serum/serum';
import { Order, OrderParams } from '@project-serum/serum/lib/market';
import { Account, Connection, PublicKey } from '@solana/web3.js';

import { Position } from '../position';
import { Strategy } from './strategy';

import PARAMS from '../params/maker.json';

export class Maker extends Strategy {
  mainnetConnection: Connection;
  mainnetMarkets: Record<string, Market>;

  constructor(
    connection: Connection,
    account: Account,
    feeDiscountPubkey: PublicKey | null,
    positions: Record<string, Position>,
    markets: Record<string, Market>,
    mainnetConnection: Connection,
    mainnetMarkets: Record<string, Market>,
  ) {
    super(connection, account, feeDiscountPubkey, positions, markets);
    this.mainnetConnection = mainnetConnection;
    this.mainnetMarkets = mainnetMarkets;
  }

  //async update(symbol: string, asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]> {
  async update(
    symbol: string,
    asks: Orderbook,
    bids: Orderbook,
  ): Promise<[OrderParams[], Order[]]> {
    let newOrders: OrderParams[] = [];
    let staleOrders: Order[] = [];

    const depth = PARAMS.depth;

    const [mainnetAsk, mainnetBid] = await Promise.all([
      await this.mainnetMarkets[symbol].loadAsks(this.mainnetConnection),
      await this.mainnetMarkets[symbol].loadBids(this.mainnetConnection),
    ]);

    const mainnetAskPriceLevels = mainnetAsk.getL2(depth);
    const mainnetBidPriceLevels = mainnetBid.getL2(depth);

    /*
    if (openOrders.length == 0) {
    */

    mainnetAskPriceLevels.forEach(priceLevel => {
      const [price, size, priceLots, sizeLots]: [number, number, BN, BN] =
        priceLevel;
      console.log(`ASK ${price} ${size}`);
      newOrders.push({
        owner: this.account,
        payer: this.positions[symbol].baseTokenAccount,
        side: 'sell',
        price,
        size,
        orderType: 'limit',
        //clientId: undefined,
        openOrdersAddressKey: this.positions[symbol].openOrdersAccount,
        feeDiscountPubkey: null,
        selfTradeBehavior: 'abortTransaction',
      });
    });

    mainnetBidPriceLevels.forEach(priceLevel => {
      const [price, size, priceLots, sizeLots]: [number, number, BN, BN] =
        priceLevel;
      console.log(`BID ${price} ${size}`);
      newOrders.push({
        owner: this.account,
        payer: this.positions[symbol].quoteTokenAccount,
        side: 'buy',
        price,
        size,
        orderType: 'limit',
        //clientId: undefined,
        openOrdersAddressKey: this.positions[symbol].openOrdersAccount,
        feeDiscountPubkey: null,
        selfTradeBehavior: 'abortTransaction',
      });
    });

    /*
    } else {

      mainnetAskPriceLevels.forEach((priceLevel) => {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
        let order;
        for (const item of asks.items()) {
          if (item.price == price) {
            order = item;
            break;
          }
        }
        if (!order) {
          newOrders.push({
            owner: this.account,
            payer: this.positions[symbol].baseTokenAccount,
            side: 'sell',
            price,
            size,
            orderType: 'limit',
            //clientId: undefined,
            openOrdersAddressKey: this.positions[symbol].openOrdersAccount,
            feeDiscountPubkey: null,
            selfTradeBehavior: 'abortTransaction',
          });
        }
      });

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

      mainnetBidPriceLevels.forEach((priceLevel) => {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
        let order;
        for (const item of bids.items()) {
          if (item.price == price) {
            order = item;
            break;
          }
        }
        if (!order) {
          newOrders.push({
            owner: this.account,
            payer: this.positions[symbol].quoteTokenAccount,
            side: 'buy',
            price,
            size,
            orderType: 'limit',
            //clientId: undefined,
            openOrdersAddressKey: this.positions[symbol].openOrdersAccount,
            feeDiscountPubkey: null,
            selfTradeBehavior: 'abortTransaction',
          });
        }
      });

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

    }
    */

    return [newOrders, staleOrders];
  }
}
