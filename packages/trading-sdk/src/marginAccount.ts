import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Account,
  AccountInfo,
  Commitment,
  Connection,
  Context,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import assert from 'assert';

import { TokenAccount } from './tokenAccount';

export class MarginAccount {
  //address: PublicKey;
  connection: Connection;
  //delegate?: Account;
  owner?: Account;
  payer: Account;

  payerBalance: number = 0;
  tokens: Record<string, TokenAccount> = {};

  constructor(params: {
    //address: PublicKey;
    connection: Connection;
    //delegate?: Account;
    owner?: Account;
    payer: Account;
  }) {
    //this.address = params.address;
    this.connection = params.connection;
    //this.delegate = params.delegate;
    this.owner = params.owner;
    this.payer = params.payer;
  }

  //TODO create a margin account if it doesn't exist.
  //static async create(connection: Connection, owner: Account, payer: Account): Promise<MarginAccount> {
  //}

  async stop(): Promise<void> {}

  async load(): Promise<void> {
    this.payerBalance = await this.connection.getBalance(this.payer.publicKey);
    console.log(
      `Payer balance = ${(this.payerBalance / LAMPORTS_PER_SOL).toFixed(
        2,
      )} SOL`,
    );

    const response = await this.connection.getTokenAccountsByOwner(
      this.owner!.publicKey, //TODO replace account with a trading account, this.address,
      {
        programId: TOKEN_PROGRAM_ID,
      },
    );
    for (const item of response.value) {
      const tokenAccount = AccountLayout.decode(Buffer.from(item.account.data));
      this.tokens[tokenAccount.mint.toBase58()] = {
        address: item.pubkey,
        balance: tokenAccount.amount,
        isNative: Number(tokenAccount.isNative) != 0,
        mint: tokenAccount.mint,
      };
    }
  }

  async listen(): Promise<void> {
    this.connection.onAccountChange(
      this.payer.publicKey,
      (accountInfo: AccountInfo<Buffer>, context: Context) => {
        this.payerBalance = accountInfo.lamports;
        console.log(
          `Payer balance = ${(this.payerBalance / LAMPORTS_PER_SOL).toFixed(
            2,
          )} SOL`,
        );
      },
      'confirmed' as Commitment,
    );

    for (const token of Object.values<TokenAccount>(this.tokens)) {
      this.connection.onAccountChange(
        token.address,
        (accountInfo: AccountInfo<Buffer>, context: Context) => {
          const tokenAccount = AccountLayout.decode(
            Buffer.from(accountInfo.data),
          );
          token.balance = tokenAccount.amount;
        },
        'confirmed' as Commitment,
      );
    }
  }

  async closeMarginAccount(): Promise<void> {}

  async borrow(mint: PublicKey, amount: number): Promise<void> {}

  async deposit(mint: PublicKey, amount: number): Promise<void> {}

  async repay(mint: PublicKey, amount: number): Promise<void> {}

  sendOrders(orders: any[]): void {
    async () => {
      try {
        //TODO send the orders.
      } catch (err) {}
    };
  }

  async setLimits(
    mint: PublicKey,
    minAmount: number,
    maxAmount: number,
  ): Promise<void> {
    //TODO
  }

  swap(): void {
    //TODO allow the user to swap tokens.
  }

  async withdraw(mint: PublicKey, amount: number): Promise<void> {}
}
