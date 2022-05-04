import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';

import { Configuration } from './configuration';

export class PositionManager {

  configuration: Configuration;
  connection: Connection;

  baseMint: PublicKey;
  quoteMint: PublicKey;

  constructor(
    configuration: Configuration,
    connection: Connection,
  ) {
    this.configuration = configuration;
    this.connection = connection;

    const asz = configuration.symbol.split('/');
    const baseToken = configuration.config.tokens.find((token) => { return token.symbol == asz[0]; })!;
    const quoteToken = configuration.config.tokens.find((token) => { return token.symbol == asz[0]; })!;

    this.baseMint = new PublicKey(baseToken.mint);
    this.quoteMint = new PublicKey(quoteToken.mint);

    //TODO create ATAs if they don't exist.

    //this.getAssociatedTokenAddress(this.baseMint)
  }

  balance: any;
  baseTokenBalance: any;
  quoteTokenBalance: any;

  async fetchPositions()
  {
    console.log(`  Balance = ${(await this.connection.getBalance(this.configuration.account.publicKey)) / LAMPORTS_PER_SOL} SOL`);
    //console.log(`  BaseTokenBalance = ${JSON.stringify(await this.getTokenBalance(await this.getAssociatedTokenAddress(this.baseMint, this.configuration.account.publicKey)))}`);
    //console.log(`  QuoteTokenBalance = ${JSON.stringify(await this.getTokenBalance(await this.getAssociatedTokenAddress(this.quoteMint, this.configuration.account.publicKey)))}`);
  }

  async createAssociatedTokenAccount(mint: PublicKey, owner: PublicKey, payer: Keypair) {
    const tokenAddress = await this.getAssociatedTokenAddress(mint, owner);
    const transaction = new Transaction().add(
      Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mint,
        tokenAddress,
        owner,
        payer.publicKey
      )
    );
    await sendAndConfirmTransaction(this.connection, transaction, [payer]);
    return tokenAddress;
  }

  async getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey) {
    return await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      owner,
    );
  }

  async getBalance(publicKey: PublicKey) {
    return await this.connection.getBalance(publicKey, 'processed');
  }

  async getTokenBalance(tokenAddress: PublicKey) {
    const balance = await this.connection.getTokenAccountBalance(tokenAddress, 'processed');
    return balance.value.uiAmount;
  }

};
