import { BN } from "@project-serum/anchor";
import { Market, Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { Account, Connection } from '@solana/web3.js';
import assert from 'assert';

import { Configuration } from '../configuration';
import { Oracle } from '../oracle';
import { PositionManager } from '../positionManager';
import { Strategy } from './strategy';

export class ReplicateMainnet extends Strategy {

  mainnetConnection: Connection;
  mainnetMarket: Market;

  constructor(
    configuration: Configuration,
    oracle: Oracle,
    positionManager: PositionManager,
    mainnetConnection: Connection,
    mainnetMarket: Market,
    ) {
    super(
      configuration,
      oracle,
      positionManager,
    );
    this.mainnetConnection = mainnetConnection;
    this.mainnetMarket = mainnetMarket;
  }

  async update(asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]> {
    let newOrders: OrderParams[] = [];
    let staleOrders: Order[] = [];

    const depth = this.configuration.params.depth;

    assert(this.mainnetMarket);
    const [ mainnetAsk, mainnetBid ] = await Promise.all([
      await this.mainnetMarket.loadAsks(this.mainnetConnection),
      await this.mainnetMarket.loadBids(this.mainnetConnection),
    ]);

    const mainnetAskPriceLevels = mainnetAsk.getL2(depth);
    const mainnetBidPriceLevels = mainnetBid.getL2(depth);

    if (openOrders.length == 0) {

      mainnetAskPriceLevels.forEach((priceLevel) => {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
        newOrders.push({
          owner: this.configuration.account,
          payer: this.positionManager.baseTokenAccount,
          side: 'sell',
          price,
          size,
          orderType: 'limit',
          //clientId: undefined,
          openOrdersAddressKey: this.configuration.openOrdersAccount.publicKey,
          openOrdersAccount: this.configuration.openOrdersAccount,
          feeDiscountPubkey: null,
          selfTradeBehavior: 'abortTransaction',
        });
      });

      mainnetBidPriceLevels.forEach((priceLevel) => {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
        newOrders.push({
          owner: this.configuration.account,
          payer: this.positionManager.quoteTokenAccount,
          side: 'buy',
          price,
          size,
          orderType: 'limit',
          //clientId: undefined,
          openOrdersAddressKey: this.configuration.openOrdersAccount.publicKey,
          openOrdersAccount: this.configuration.openOrdersAccount,
          feeDiscountPubkey: null,
          selfTradeBehavior: 'abortTransaction',
        });
      });

    } else {
      mainnetAskPriceLevels.forEach((priceLevel) => {
        const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
        const order = openOrders.find((order) => { return order.priceLots.eq(priceLots); });
        if (!order) {
          newOrders.push({
            owner: this.configuration.account,
            payer: this.positionManager.baseTokenAccount,
            side: 'sell',
            price,
            size,
            orderType: 'limit',
            //clientId: undefined,
            openOrdersAddressKey: this.configuration.openOrdersAccount.publicKey,
            openOrdersAccount: this.configuration.openOrdersAccount,
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
        const order = openOrders.find((order) => { return order.priceLots.eq(priceLots); });
        if (!order) {
          newOrders.push({
            owner: this.configuration.account,
            payer: this.positionManager.quoteTokenAccount,
            side: 'buy',
            price,
            size,
            orderType: 'limit',
            //clientId: undefined,
            openOrdersAddressKey: this.configuration.openOrdersAccount.publicKey,
            openOrdersAccount: this.configuration.openOrdersAccount,
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

    return [newOrders, staleOrders];
  }

}
