import { BN } from "@project-serum/anchor";
import { DexInstructions, Market, Orderbook, OpenOrders } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { Account, Connection, PublicKey, sendAndConfirmTransaction, Transaction, TransactionInstruction, TransactionSignature } from '@solana/web3.js';
import assert from 'assert';

import { Configuration } from './configuration';
import { Oracle } from './oracle';
import { PositionManager } from './positionManager';
import { findOpenOrdersAccounts, getAssociatedTokenAddress } from './utils';

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
        DexInstructions.initOpenOrders({
          market: this.market.address,
          openOrders: this.configuration.openOrdersAccount.publicKey,
          owner: this.configuration.account.publicKey,
          programId: this.market.programId,
          marketAuthority: undefined,
        }),
      );
      await sendAndConfirmTransaction(this.connection, transaction, [this.configuration.account, this.configuration.openOrdersAccount], { commitment: 'confirmed' });

      openOrdersAccountInfo = await this.connection.getAccountInfo(this.configuration.openOrdersAccount.publicKey);
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

  async closeOpenOrdersAccounts()
  {
    if (this.configuration.verbose) {
      console.log(`closeOpenOrdersAccounts`);
    }

    const openOrdersAccounts = await findOpenOrdersAccounts(
      this.connection,
      this.market.address,
      this.configuration.account.publicKey,
      this.market.programId,
      this.mainnetMarket.programId,
    );

    const baseWallet = await getAssociatedTokenAddress(new PublicKey(this.market.baseMintAddress), this.configuration.account.publicKey);
    const quoteWallet = await getAssociatedTokenAddress(new PublicKey(this.market.quoteMintAddress), this.configuration.account.publicKey);

    // @ts-ignore
    const vaultSigner = await PublicKey.createProgramAddress(
      [
        this.market.address.toBuffer(),
        this.market.decoded.vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
      ],
      this.market.programId,
    );

    for (const openOrdersAccount of openOrdersAccounts) {

      let transaction = new Transaction();

      if (this.positionManager.baseTokenBalance != 0 || this.positionManager.quoteTokenBalance != 0) {
        transaction.add(
          DexInstructions.settleFunds({
            market: this.market.address,
            openOrders: openOrdersAccount,
            owner: this.configuration.account.publicKey,
            baseVault: this.market.decoded.baseVault,
            quoteVault: this.market.decoded.quoteVault,
            baseWallet,
            quoteWallet,
            vaultSigner,
            programId: this.market.programId,
            //TODO referrerQuoteWallet,
          })
        );
      }

      transaction.add(
        DexInstructions.closeOpenOrders({
          market: this.market.address,
          openOrders: openOrdersAccount,
          owner: this.configuration.account.publicKey,
          solWallet: this.configuration.account.publicKey,
          programId: this.market.programId,
        })
      );

      await this.connection.sendTransaction(transaction, [this.configuration.account]);
    }
  }

  async updateOrders(newOrders: OrderParams[], cancelOrders: Order[])
  {
    if (cancelOrders.length > 0) {
      await Promise.all(cancelOrders.map(async (order) => {
        await this.market.cancelOrder(this.connection, this.configuration.account, order);
      }));
    }

    if (newOrders.length > 0) {
      await Promise.all(newOrders.map(async (orderParams) => {
        await this.placeOrder(this.connection, orderParams);
      }));
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
