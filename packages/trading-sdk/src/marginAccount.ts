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

import { Position } from './position';

export class MarginAccount {
  //address: PublicKey;
  connection: Connection;
  //delegate?: Account;
  owner?: Account;
  payer: Account;

  payerBalance: number = 0;
  positions: Record<string, Position> = {};

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
  //static async create(connection: Connection, owner: Account, payer: Account): Promise<MarginAccount> {}

  async stop(): Promise<void> {}

  async load(config: any): Promise<void> {
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
      const tokenConfig = config.tokens.find(tokenConfig => {
        return tokenConfig.mint == tokenAccount.mint.toBase58();
      });
      if (tokenConfig) {
        this.positions[tokenConfig.symbol] = new Position({
          balance: tokenAccount.amount,
          decimals: tokenConfig.decimals,
          isNative: Number(tokenAccount.isNative) != 0,
          mint: tokenAccount.mint,
          symbol: tokenConfig.symbol,
          tokenAccount: item.pubkey,
        });
      }
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

    for (const position of Object.values<Position>(this.positions)) {
      this.connection.onAccountChange(
        position.tokenAccount,
        (accountInfo: AccountInfo<Buffer>, context: Context) => {
          const tokenAccount = AccountLayout.decode(
            Buffer.from(accountInfo.data),
          );
          position.balance = tokenAccount.amount;
        },
        'confirmed' as Commitment,
      );
    }
  }

  async closeMarginAccount(): Promise<void> {
    //TODO
  }

  async borrow(mint: PublicKey, amount: number): Promise<void> {
    //TODO
  }

  async deposit(mint: PublicKey, amount: number): Promise<void> {
    //TODO
  }

  async repay(mint: PublicKey, amount: number): Promise<void> {
    //TODO
  }

  sendOrders(orders: any[]): void {
    async () => {
      try {
        //TODO send the orders.
      } catch (err) {}
    };
  }

  async setLimits(
    symbol: string,
    minAmount: number,
    maxAmount: number,
  ): Promise<void> {
    assert(minAmount < maxAmount);
    this.positions[symbol].minAmount = minAmount;
    this.positions[symbol].maxAmount = maxAmount;
  }

  swap(): void {
    //TODO allow the user to swap tokens. This would be useful in closing out positions or hedging.
  }

  async withdraw(mint: PublicKey, amount: number): Promise<void> {
    //TODO
  }
}
