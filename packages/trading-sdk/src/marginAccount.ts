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

import { TokenAccount } from './tokenAccount';

export class MarginAccount {
  address: PublicKey;
  connection: Connection;
  delegate?: Account;
  owner?: Account;
  payer: Account;

  payerBalance: number = 0;
  tokens: Record<string, TokenAccount> = {};

  constructor(params: {
    address: PublicKey;
    connection: Connection;
    delegate?: Account;
    owner?: Account;
    payer: Account;
  }) {
    this.address = params.address;
    this.connection = params.connection;
    this.delegate = params.delegate;
    this.owner = params.owner;
    this.payer = params.payer;
  }

  //static async create(connection: Connection, owner: Account, payer: Account): Promise<MarginAccount> {
  //const marginAccount = new MarginAccount(connection, owner, payer);
  //return marginAccount;
  //}

  async load(): Promise<void> {
    this.payerBalance = await this.connection.getBalance(this.payer.publicKey);
    console.log(
      `Payer balance = ${(this.payerBalance / LAMPORTS_PER_SOL).toFixed(
        2,
      )} SOL`,
    );

    const response = await this.connection.getTokenAccountsByOwner(
      this.address,
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

  async closeAccount(): Promise<void> {}

  async borrow(mint: PublicKey, amount: number): Promise<void> {}

  async deposit(mint: PublicKey, amount: number): Promise<void> {}

  async repay(mint: PublicKey, amount: number): Promise<void> {}

  async setLimits(
    mint: PublicKey,
    minAmount: number,
    maxAmount: number,
  ): Promise<void> {}

  async withdraw(mint: PublicKey, amount: number): Promise<void> {}
}
