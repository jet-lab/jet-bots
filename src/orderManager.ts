import { BN } from "@project-serum/anchor";
import { Market, Orderbook, OpenOrders } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { Account, Connection, PublicKey, sendAndConfirmTransaction, Transaction, TransactionInstruction, TransactionSignature } from '@solana/web3.js';
import assert from 'assert';

import { Configuration } from './configuration';
import { Oracle } from './oracle';
import { PositionManager } from './positionManager';
import { findOpenOrdersAccounts } from './utils';

export class OrderManager {

  configuration: Configuration;
  connection: Connection;
  mainnetConnection: Connection;
  market: Market;
  mainnetMarket: Market;
  oracle: Oracle;
  positionManager: PositionManager;

  constructor(
    configuration: Configuration,
    connection: Connection,
    mainnetConnection: Connection,
    market: Market,
    mainnetMarket: Market,
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

  async init(): Promise<void>
  {
    let openOrdersAccountInfo = await this.connection.getAccountInfo(this.configuration.openOrdersAccount.publicKey);

    if (openOrdersAccountInfo == null) {
      let transaction = new Transaction().add(
        await OpenOrders.makeCreateAccountTransaction(
          this.connection,
          this.market.address,
          this.configuration.account.publicKey,
          this.configuration.openOrdersAccount.publicKey,
          this.market.programId,
        ),
      );
      await sendAndConfirmTransaction(this.connection, transaction, [this.configuration.account, this.configuration.openOrdersAccount], { commitment: 'confirmed' });

      openOrdersAccountInfo = await this.connection.getAccountInfo(this.configuration.openOrdersAccount.publicKey);
      assert(false);
    }

    assert(openOrdersAccountInfo);
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
                openOrdersAddressKey: this.configuration.openOrdersAccount.publicKey,
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
                openOrdersAddressKey: this.configuration.openOrdersAccount.publicKey,
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

          await Promise.all(staleOrders.map(async (order) => {
            await this.market.cancelOrder(this.connection, this.configuration.account, order);
          }));

          await Promise.all(newOrders.map(async (orderParams) => {
            await this.placeOrder(this.connection, orderParams);
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

  async placeOrder(
    connection: Connection,
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
    >(connection, {
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
    return await this._sendTransaction(connection, transaction, [
      owner,
      ...signers,
    ]);
  }

  async makePlaceOrderTransaction<T extends PublicKey | Account>(
    connection: Connection,
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

    const placeOrderInstruction = this.makePlaceOrderInstruction(connection, {
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
    if (this.market.baseSizeNumberToLots(size).lte(new BN(0))) {
      throw new Error('size too small');
    }
    if (this.market.priceNumberToLots(price).lte(new BN(0))) {
      throw new Error('invalid price');
    }
    return this.market.makeNewOrderV3Instruction(params);
  }

  private async _sendTransaction(
    connection: Connection,
    transaction: Transaction,
    signers: Array<Account>,
  ): Promise<TransactionSignature> {
    const signature = await connection.sendTransaction(transaction, signers, {
      skipPreflight: true,
    });
    const { value } = await connection.confirmTransaction(
      signature,
      'processed',
    );
    if (value?.err) {
      throw new Error(JSON.stringify(value.err));
    }
    return signature;
  }

};
