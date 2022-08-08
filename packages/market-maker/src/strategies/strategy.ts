import { BN } from '@project-serum/anchor';
import { Market, Orderbook } from '@project-serum/serum';
import { Order, OrderParams } from '@project-serum/serum/lib/market';
import {
  Account,
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import assert from 'assert';

import { Position } from '../position';

export abstract class Strategy {
  connection: Connection;
  account: Account;
  feeDiscountPubkey: PublicKey | null;
  positions: Record<string, Position> = {};
  markets: Record<string, Market> = {};

  constructor(
    connection: Connection,
    account: Account,
    feeDiscountPubkey: PublicKey | null,
    positions: Record<string, Position>,
    markets: Record<string, Market>,
  ) {
    this.connection = connection;
    this.account = account;
    this.feeDiscountPubkey = feeDiscountPubkey;
    this.positions = positions;
    this.markets = markets;
  }

  async cancelOpenOrders() {
    for (const market of Object.values<Market>(this.markets)) {
      const openOrders = await market.loadOrdersForOwner(
        this.connection,
        this.account.publicKey,
      );
      for (const openOrder of openOrders) {
        await market.cancelOrder(this.connection, this.account, openOrder);
      }
    }
  }

  async closeOpenOrdersAccounts() {
    for (const position of Object.values<Position>(this.positions)) {
      await position.closeOpenOrdersAccounts();
    }
  }

  //abstract update(symbol: string, asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]>;
  abstract update(
    symbol: string,
    asks: Orderbook,
    bids: Orderbook,
  ): Promise<[OrderParams[], Order[]]>;

  async updateOrders(
    market: Market,
    newOrders: OrderParams[],
    cancelOrders: Order[],
  ) {
    if (cancelOrders.length > 0) {
      for (const order of cancelOrders) {
        await market.cancelOrder(this.connection, this.account, order);
      }
    }

    if (newOrders.length > 0) {
      for (const orderParams of newOrders) {
        await this.placeOrder(this.connection, market, orderParams);
      }
    }
  }

  async placeOrder(
    connection: Connection,
    market: Market,
    {
      owner,
      payer,
      side,
      price,
      size,
      orderType = 'limit',
      clientId,
      openOrdersAddressKey,
      openOrdersAccount,
      feeDiscountPubkey,
      maxTs,
      replaceIfExists = false,
    }: OrderParams,
  ) {
    assert(openOrdersAddressKey);

    const { transaction, signers } =
      await this.makePlaceOrderTransaction<Account>(market, {
        owner,
        payer,
        side,
        price,
        size,
        orderType,
        clientId,
        openOrdersAddressKey,
        openOrdersAccount,
        feeDiscountPubkey,
        maxTs,
        replaceIfExists,
      });
    return await sendAndConfirmTransaction(
      connection,
      transaction,
      [owner, ...signers],
      { skipPreflight: true, commitment: 'processed' },
    );
  }

  async makePlaceOrderTransaction<T extends PublicKey | Account>(
    market: Market,
    {
      owner,
      payer,
      side,
      price,
      size,
      orderType = 'limit',
      clientId,
      openOrdersAddressKey,
      openOrdersAccount,
      feeDiscountPubkey,
      selfTradeBehavior = 'decrementTake',
      maxTs,
      replaceIfExists = false,
    }: OrderParams<T>,
  ) {
    const transaction = new Transaction();
    const signers: Account[] = [];

    const placeOrderInstruction = this.makePlaceOrderInstruction(market, {
      owner,
      payer: payer,
      side,
      price,
      size,
      orderType,
      clientId,
      openOrdersAddressKey,
      feeDiscountPubkey,
      selfTradeBehavior,
      maxTs,
      replaceIfExists,
    });
    transaction.add(placeOrderInstruction);

    return { transaction, signers, payer: owner };
  }

  makePlaceOrderInstruction<T extends PublicKey | Account>(
    market: Market,
    params: OrderParams<T>,
  ): TransactionInstruction {
    const {
      owner,
      payer,
      side,
      price,
      size,
      orderType = 'limit',
      clientId,
      openOrdersAddressKey,
      openOrdersAccount,
      feeDiscountPubkey,
    } = params;
    if (market.baseSizeNumberToLots(size).lte(new BN(0))) {
      console.log(`size = ${size}`);
      console.log(
        `market.baseSizeNumberToLots(size) = ${market.baseSizeNumberToLots(
          size,
        )}`,
      );
      throw new Error('size too small');
    }
    if (market.priceNumberToLots(price).lte(new BN(0))) {
      console.log(`price = ${price}`);
      console.log(
        `market.priceNumberToLots(price) = ${market.priceNumberToLots(price)}`,
      );
      throw new Error('invalid price');
    }
    return market.makeNewOrderV3Instruction(params);
  }
}
