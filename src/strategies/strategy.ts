import { BN } from "@project-serum/anchor";
import { Market, Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { Account, Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import assert from 'assert';

import { Position } from '../position';

export abstract class Strategy {

  connection: Connection;
  account: Account;
  positions: Position[];
  markets: Market[];

  constructor(
    connection: Connection,
    account: Account,
    positions: Position[],
    markets: Market[],
  ) {
    this.connection = connection;
    this.account = account;
    this.positions = positions;
    this.markets = markets;
  }

  async cancelOpenOrders()
  {
    for (const market of this.markets) {
      const openOrders = await market.loadOrdersForOwner(this.connection, this.account.publicKey);
      for (const openOrder of openOrders) {
        await market.cancelOrder(this.connection, this.account, openOrder);
      }
    }
  }

  async closeOpenOrdersAccounts()
  {
    for (const position of this.positions) {
      await position.closeOpenOrdersAccounts();
    }
  }

  abstract update(marketIndex: number, asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]>;

  async updateOrders(market: Market, newOrders: OrderParams[], cancelOrders: Order[])
  {
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

    const { transaction, signers } = await this.makePlaceOrderTransaction<
      Account
    >(connection, market, {
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
    return await connection.sendTransaction(transaction, [
      owner,
      ...signers,
    ]);
  }

  async makePlaceOrderTransaction<T extends PublicKey | Account>(
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
      feeDiscountPubkey = undefined,
      selfTradeBehavior = 'decrementTake',
      maxTs,
      replaceIfExists = false,
    }: OrderParams<T>,
    cacheDurationMs = 0,
    feeDiscountPubkeyCacheDurationMs = 0,
  ) {
    /*
    // @ts-ignore
    const ownerAddress: PublicKey = owner.publicKey ?? owner;
    const openOrdersAccounts = await this.findOpenOrdersAccountsForOwner(
      connection,
      ownerAddress,
      cacheDurationMs,
    );
    */
    const transaction = new Transaction();
    const signers: Account[] = [];

    /*
    // Fetch an SRM fee discount key if the market supports discounts and it is not supplied
    let useFeeDiscountPubkey: PublicKey | null;
    if (feeDiscountPubkey) {
      useFeeDiscountPubkey = feeDiscountPubkey;
    } else if (
      feeDiscountPubkey === undefined &&
      this.supportsSrmFeeDiscounts
    ) {
      useFeeDiscountPubkey = (
        await this.findBestFeeDiscountKey(
          connection,
          ownerAddress,
          feeDiscountPubkeyCacheDurationMs,
        )
      ).pubkey;
    } else {
      useFeeDiscountPubkey = null;
    }
    */

    /*
    let openOrdersAddress: PublicKey;
    if (openOrdersAccounts.length === 0) {
      let account;
      if (openOrdersAccount) {
        account = openOrdersAccount;
      } else {
        account = new Account();
      }
      transaction.add(
        await OpenOrders.makeCreateAccountTransaction(
          connection,
          this.address,
          ownerAddress,
          account.publicKey,
          this._programId,
        ),
      );
      openOrdersAddress = account.publicKey;
      signers.push(account);
      // refresh the cache of open order accounts on next fetch
      this._openOrdersAccountsCache[ownerAddress.toBase58()].ts = 0;
    } else if (openOrdersAccount) {
      openOrdersAddress = openOrdersAccount.publicKey;
    } else if (openOrdersAddressKey) {
      openOrdersAddress = openOrdersAddressKey;
    } else {
      openOrdersAddress = openOrdersAccounts[0].address;
    }
    */

    /*
    let wrappedSolAccount: Account | null = null;
    if (payer.equals(ownerAddress)) {
      if (
        (side === 'buy' && this.quoteMintAddress.equals(WRAPPED_SOL_MINT)) ||
        (side === 'sell' && this.baseMintAddress.equals(WRAPPED_SOL_MINT))
      ) {
        wrappedSolAccount = new Account();
        let lamports;
        if (side === 'buy') {
          lamports = Math.round(price * size * 1.01 * LAMPORTS_PER_SOL);
          if (openOrdersAccounts.length > 0) {
            lamports -= openOrdersAccounts[0].quoteTokenFree.toNumber();
          }
        } else {
          lamports = Math.round(size * LAMPORTS_PER_SOL);
          if (openOrdersAccounts.length > 0) {
            lamports -= openOrdersAccounts[0].baseTokenFree.toNumber();
          }
        }
        lamports = Math.max(lamports, 0) + 1e7;
        transaction.add(
          SystemProgram.createAccount({
            fromPubkey: ownerAddress,
            newAccountPubkey: wrappedSolAccount.publicKey,
            lamports,
            space: 165,
            programId: TOKEN_PROGRAM_ID,
          }),
        );
        transaction.add(
          initializeAccount({
            account: wrappedSolAccount.publicKey,
            mint: WRAPPED_SOL_MINT,
            owner: ownerAddress,
          }),
        );
        signers.push(wrappedSolAccount);
      } else {
        throw new Error('Invalid payer account');
      }
    }
    */

    const placeOrderInstruction = this.makePlaceOrderInstruction(connection, market, {
      owner,
      //payer: wrappedSolAccount?.publicKey ?? payer,
      payer: payer,
      side,
      price,
      size,
      orderType,
      clientId,
      openOrdersAddressKey,
      //feeDiscountPubkey: useFeeDiscountPubkey,
      selfTradeBehavior,
      maxTs,
      replaceIfExists,
    });
    transaction.add(placeOrderInstruction);

    /*
    if (wrappedSolAccount) {
      transaction.add(
        closeAccount({
          source: wrappedSolAccount.publicKey,
          destination: ownerAddress,
          owner: ownerAddress,
        }),
      );
    }
    */

    return { transaction, signers, payer: owner };
  }

  makePlaceOrderInstruction<T extends PublicKey | Account>(
    connection: Connection,
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
      feeDiscountPubkey = null,
    } = params;
    if (market.baseSizeNumberToLots(size).lte(new BN(0))) {
      throw new Error('size too small');
    }
    if (market.priceNumberToLots(price).lte(new BN(0))) {
      throw new Error('invalid price');
    }
    return market.makeNewOrderV3Instruction(params);
  }

}
