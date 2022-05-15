import { BN } from "@project-serum/anchor";
import { Market, Orderbook, OpenOrders } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { Account, Connection, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import assert from 'assert';

import { Configuration } from './configuration';
import { Oracle } from './oracle';
import { PositionManager } from './positionManager';

export class OrderManager {

  configuration: Configuration;
  connection: Connection;
  mainnetConnection: Connection;
  market: Market;
  mainnetMarket: Market | undefined;
  oracle: Oracle;
  positionManager: PositionManager;

  constructor(
    configuration: Configuration,
    connection: Connection,
    mainnetConnection: Connection,
    market: Market,
    mainnetMarket: Market | undefined,
    oracle: Oracle,
    positionManager: PositionManager,
  ) {
    this.configuration = configuration;
    this.connection = connection;
    this.mainnetConnection = mainnetConnection;
    this.market = market;
    this.mainnetMarket = mainnetMarket;
    this.oracle = oracle;
    this.positionManager = positionManager;
  }

  async cancelOpenOrders()
  {
    if (this.configuration.verbose) {
      console.log(`cancelOpenOrders`);
    }

    const openOrders = await this.market.loadOrdersForOwner(this.connection, this.configuration.account.publicKey);

    await Promise.all(openOrders.map(async (order) => {
      await this.market.cancelOrder(this.connection, this.configuration.account, order);
    }));
  }

  async updateOrders(asks: Orderbook, bids: Orderbook, openOrders: Order[])
  {
    switch (this.configuration.params.type) {
      case 'fixed-spread':
        {
          const fairValue: number = this.oracle.price?.price!;
          const halfSpread: number = fairValue * this.configuration.params.spreadBPS * 0.0001;

          const askPrice: number = fairValue + halfSpread;
          const bidPrice: number = fairValue - halfSpread;

          //TODO implement.

          //const baseOpenOrdersBalance = market.baseOpenOrdersBalance;
          //const quoteOpenOrdersBalance = market.quoteOpenOrdersBalance;
          //const accountValue = ((baseTokenBalance + baseOpenOrdersBalance) * fairValue) + (quoteTokenBalance + quoteOpenOrdersBalance);

          //const quoteSize = accountValue * this.configuration.params.sizePercent;

          break;
        }
      case 'replicate-mainnet':
        {
          let newOrders: OrderParams<Account>[] = [];
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
            await Promise.all(mainnetAskPriceLevels.map(async (priceLevel) => {
              const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
              newOrders.push({
                owner: this.configuration.account,
                payer: this.positionManager.baseTokenAccount,
                side: 'sell',
                price,
                size,
                orderType: 'limit',
                //clientId: undefined,
                openOrdersAccount: this.configuration.openOrdersAccount,
                feeDiscountPubkey: null,
                selfTradeBehavior: 'abortTransaction',
              });
            }));

            await Promise.all(mainnetBidPriceLevels.map(async (priceLevel) => {
              const [ price, size, priceLots, sizeLots ]: [number, number, BN, BN] = priceLevel;
              newOrders.push({
                owner: this.configuration.account,
                payer: this.positionManager.quoteTokenAccount,
                side: 'buy',
                price,
                size,
                orderType: 'limit',
                //clientId: undefined,
                openOrdersAccount: this.configuration.openOrdersAccount,
                feeDiscountPubkey: null,
                selfTradeBehavior: 'abortTransaction',
              });
            }));
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

          await Promise.all(staleOrders.map(async (order) => {
            await this.market.cancelOrder(this.connection, this.configuration.account, order);
          }));

          await Promise.all(newOrders.map(async (orderParams) => {
            await this.market.placeOrder(this.connection, orderParams);
          }));

          break;
        }
      default:
        {
          console.log(`Unhandled params: ${this.configuration.params.type}`);
          process.exit();
        }
    }

  }

};
