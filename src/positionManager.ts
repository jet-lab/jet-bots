import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import { Configuration } from './configuration';

export class PositionManager {

  configuration: Configuration;
  connection: Connection;
  baseTokenAccount: PublicKey;
  quoteTokenAccount: PublicKey;

  balance: number = 0;
  baseTokenBalance: number = 0;
  quoteTokenBalance: number = 0;

  constructor(
    configuration: Configuration,
    connection: Connection,
    baseTokenAccount: PublicKey,
    quoteTokenAccount: PublicKey,
  ) {
    this.configuration = configuration;
    this.connection = connection;
    this.baseTokenAccount = baseTokenAccount;
    this.quoteTokenAccount = quoteTokenAccount;
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
    //TODO
    /*
      let transaction = new Transaction().add(

        settlefunds

      );
      await this.connection.sendTransaction(transaction, [this.configuration.account]);
    */
  }

};
