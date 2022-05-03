import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';

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

    /*
      {
        "symbol": "BTC",
        "mint": "BmvvCZaumAWsM1QZcdH892wQaqYTFCk6BDxMZnqzSkSr",
        "mintPrivateKey": "NjmZPv7SZbY6ktlXMBJgXcSFBa3JuEICYEGF+Wk0+RGgF2OnJP2vSa8x/rTT1k94o0KUhnxd6ABzICG2g+JCnw==",
        "mintSupply": 10000000000,
        "faucet": "DS5afyteSUf8uiShzVWcZdS2Fp5xboTBMHdteDcY5RGe",
        "faucetPrivateKey": "brKeFP/o+PU7MIyJPGLu9fUKJciMuWOpB1I69Oe/EWy4uPFNpkZXqf4tMDcouq86jJoS8zb80iGhW/b/8G3b2w==",
        "faucetSupply": 9000000000,
        "decimals": 6
      },
    */
  }

  async fetchPositions()
  {
    //const accountInfos = await getMultipleAccounts(connection, allAccounts);
  }

  async createTokenAccount(mint: PublicKey, owner: PublicKey, payer: Keypair) {
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
