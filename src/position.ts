import { BN } from "@project-serum/anchor";
import { DexInstructions, Market, OpenOrders } from "@project-serum/serum";
import { Account, Connection, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import assert from 'assert';

import { findOpenOrdersAccounts, getAssociatedTokenAddress } from './utils';

export class Position {

  config: any;
  connection: Connection;
  account: Account;
  baseTokenAccount: PublicKey;
  quoteTokenAccount: PublicKey;
  market: Market;
  openOrdersAccount: PublicKey;

  balance: number = 0;
  baseTokenBalance: number = 0;
  quoteTokenBalance: number = 0;

  constructor(
    config: any,
    connection: Connection,
    account: Account,
    baseTokenAccount: PublicKey,
    quoteTokenAccount: PublicKey,
    market: Market,
    openOrdersAccount: PublicKey,
  ) {
    this.config = config;
    this.connection = connection;
    this.account = account;
    this.baseTokenAccount = baseTokenAccount;
    this.quoteTokenAccount = quoteTokenAccount;
    this.market = market;
    this.openOrdersAccount = openOrdersAccount;
  }

  async init(): Promise<void>
  {
    let openOrdersAccountInfo = await this.connection.getAccountInfo(this.openOrdersAccount);
    assert(openOrdersAccountInfo);
  }

  async closeOpenOrdersAccounts()
  {
    console.log(`closeOpenOrdersAccounts`);

    const openOrdersAccounts = await findOpenOrdersAccounts(
      this.connection,
      this.market.address,
      this.account.publicKey,
      this.market.programId,
    );

    const baseWallet = await getAssociatedTokenAddress(new PublicKey(this.market.baseMintAddress), this.account.publicKey);
    const quoteWallet = await getAssociatedTokenAddress(new PublicKey(this.market.quoteMintAddress), this.account.publicKey);

    // @ts-ignore
    const vaultSigner = await PublicKey.createProgramAddress(
      [
        this.market.address.toBuffer(),
        this.market.decoded.vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
      ],
      this.market.programId,
    );

    for (const openOrdersAccount of openOrdersAccounts) {

      const accountInfo = await this.connection.getAccountInfo(openOrdersAccount);
      if (!accountInfo) continue;
      const openOrders = OpenOrders.fromAccountInfo(openOrdersAccount, accountInfo, this.market.programId);
      let hasOrders = false;
      openOrders.orders.forEach((orderId) => { if (!orderId.eq(new BN(0))) hasOrders = true; });
      if (hasOrders) continue;

      let transaction = new Transaction();

      await this.fetchBalances();

      if (this.baseTokenBalance != 0 || this.quoteTokenBalance != 0) {
        transaction.add(
          DexInstructions.settleFunds({
            market: this.market.address,
            openOrders: openOrdersAccount,
            owner: this.account.publicKey,
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
          owner: this.account.publicKey,
          solWallet: this.account.publicKey,
          programId: this.market.programId,
        })
      );

      await this.connection.sendTransaction(transaction, [this.account]);
    }
  }

  async fetchBalances() {
    this.balance = await this.connection.getBalance(this.account.publicKey);
    this.baseTokenBalance = (await this.getTokenBalance(this.baseTokenAccount))!;
    this.quoteTokenBalance = (await this.getTokenBalance(this.quoteTokenAccount))!;
  }

  async getBalance(publicKey: PublicKey) {
    return await this.connection.getBalance(publicKey, 'processed');
  }

  static async getOrCreateOpenOrdersAccount(
    connection: Connection,
    marketAddress: PublicKey,
    owner: Account,
    serumProgramId: PublicKey,
  ): Promise<PublicKey> {

    const openOrdersAccounts = await findOpenOrdersAccounts(
      connection,
      marketAddress,
      owner.publicKey,
      serumProgramId,
    );

    if (openOrdersAccounts.length > 0) {
      return openOrdersAccounts[0];
    }

    const openOrdersAccount = new Account();

    let transaction = new Transaction().add(
      await OpenOrders.makeCreateAccountTransaction(
        connection,
        marketAddress,
        owner.publicKey,
        openOrdersAccount.publicKey,
        serumProgramId,
      ),
      DexInstructions.initOpenOrders({
        market: marketAddress,
        openOrders: openOrdersAccount.publicKey,
        owner: owner.publicKey,
        programId: serumProgramId,
        marketAuthority: undefined,
      }),
    );

    await sendAndConfirmTransaction(connection, transaction, [owner, openOrdersAccount], { commitment: 'confirmed' });

    return openOrdersAccount.publicKey;
  }

  async getTokenBalance(tokenAddress: PublicKey) {
    const balance = await this.connection.getTokenAccountBalance(tokenAddress, 'processed');
    return balance.value.uiAmount;
  }

  async settleFunds()
  {
    // @ts-ignore
    const vaultSigner = await PublicKey.createProgramAddress(
      [
        this.market.address.toBuffer(),
        this.market.decoded.vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
      ],
      this.market.programId,
    );

    let transaction = new Transaction().add(
      DexInstructions.settleFunds({
        market: this.market.address,
        openOrders: this.openOrdersAccount,
        owner: this.account.publicKey,
        baseVault: this.market.decoded.baseVault,
        quoteVault: this.market.decoded.quoteVault,
        baseWallet: this.baseTokenAccount,
        quoteWallet: this.quoteTokenAccount,
        vaultSigner,
        programId: this.market.programId,
        //TODO referrerQuoteWallet,
      }),
      DexInstructions.closeOpenOrders({
        market: this.market.address,
        openOrders: this.openOrdersAccount,
        owner: this.account.publicKey,
        solWallet: this.account.publicKey,
        programId: this.market.programId,
      })
    );
    await this.connection.sendTransaction(transaction, [this.account]);
  }

};
