import {
  Account,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';

export class MarginAccount {
  connection: Connection;
  owner: Account;
  payer: Account;

  payerBalance: number = 0;

  constructor(connection: Connection, owner: Account, payer: Account) {
    this.connection = connection;
    this.owner = owner;
    this.payer = payer;
  }

  //static async create(connection: Connection, owner: Account, payer: Account): Promise<MarginAccount> {
  //const marginAccount = new MarginAccount(connection, owner, payer);
  //return marginAccount;
  //}

  async load(): Promise<void> {
    this.payerBalance = await this.connection.getBalance(this.payer.publicKey);
    console.log(
      `MarginAccount balance = ${(this.payerBalance / LAMPORTS_PER_SOL).toFixed(
        2,
      )} SOL`,
    );
  }

  async listen(): Promise<void> {}

  async closeAccount(): Promise<void> {}

  async deposit(mint: PublicKey, amount: number): Promise<void> {}

  async withdraw(mint: PublicKey, amount: number): Promise<void> {}
}
