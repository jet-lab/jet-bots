import { DexInstructions, Market } from "@project-serum/serum";
import { Connection, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';

import { Configuration } from './configuration';

export class PositionManager {

  configuration: Configuration;
  connection: Connection;
  baseTokenAccount: PublicKey;
  quoteTokenAccount: PublicKey;
  market: Market;

  balance: number = 0;
  baseTokenBalance: number = 0;
  quoteTokenBalance: number = 0;

  constructor(
    configuration: Configuration,
    connection: Connection,
    baseTokenAccount: PublicKey,
    quoteTokenAccount: PublicKey,
    market: Market,
  ) {
    this.configuration = configuration;
    this.connection = connection;
    this.baseTokenAccount = baseTokenAccount;
    this.quoteTokenAccount = quoteTokenAccount;
    this.market = market;
  }

  async init(): Promise<void>
  {
    //TODO check that the token accounts already exist.

    //await this.getTokenAccountsByOwnerForMint(
      //connection,
      //ownerAddress,
      //this.baseMintAddress,
    //);
  }

  async fetchBalances() {
    this.balance = await this.connection.getBalance(this.configuration.account.publicKey);
    this.baseTokenBalance = (await this.getTokenBalance(this.baseTokenAccount))!;
    this.quoteTokenBalance = (await this.getTokenBalance(this.quoteTokenAccount))!;

    if (this.configuration.verbose) {
      console.log(`Account balance = ${this.balance / LAMPORTS_PER_SOL} SOL`);
      console.log(`Base token balance = ${JSON.stringify(this.baseTokenBalance)}`);
      console.log(`Quote token balance = ${JSON.stringify(this.quoteTokenBalance)}`);
    }
  }

  async getBalance(publicKey: PublicKey) {
    return await this.connection.getBalance(publicKey, 'processed');
  }

  async getTokenBalance(tokenAddress: PublicKey) {
    const balance = await this.connection.getTokenAccountBalance(tokenAddress, 'processed');
    return balance.value.uiAmount;
  }

  async settleFunds()
  {
    if (this.configuration.verbose) {
      console.log(`settleFunds`);
    }

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
        openOrders: this.configuration.openOrdersAccount.publicKey,
        owner: this.configuration.account.publicKey,
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
        openOrders: this.configuration.openOrdersAccount.publicKey,
        owner: this.configuration.account.publicKey,
        solWallet: this.configuration.account.publicKey,
        programId: this.market.programId,
      })
    );
    await this.connection.sendTransaction(transaction, [this.configuration.account]);
  }

};
