import { BN } from '@project-serum/anchor';
import {
  AccountLayout,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Account,
  AccountInfo,
  Commitment,
  Connection,
  Context,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import assert from 'assert';

import { Position } from './position';
import { airdropTokens } from './utils';

export class MarginAccount {
  //address: PublicKey;
  config: any;
  connection: Connection;
  //delegate?: Account;
  owner?: Account;
  payer: Account;

  payerBalance: number = 0;
  positions: Record<string, Position> = {};

  constructor(params: {
    //address: PublicKey;
    config: any;
    connection: Connection;
    //delegate?: Account;
    owner?: Account;
    payer: Account;
  }) {
    //this.address = params.address;
    this.config = params.config;
    this.connection = params.connection;
    //this.delegate = params.delegate;
    this.owner = params.owner;
    this.payer = params.payer;
  }

  //TODO create a margin account if it doesn't exist.
  //static async create(connection: Connection, owner: Account, payer: Account): Promise<MarginAccount> {}

  async load(): Promise<void> {
    this.payerBalance = await this.connection.getBalance(this.payer.publicKey);

    const response = await this.connection.getTokenAccountsByOwner(
      this.owner!.publicKey, //TODO replace account with a trading account, this.address,
      {
        programId: TOKEN_PROGRAM_ID,
      },
    );
    for (const item of response.value) {
      const tokenAccount = AccountLayout.decode(Buffer.from(item.account.data));
      const tokenConfig = Object.values<any>(this.config.tokens).find(
        tokenConfig => {
          return tokenConfig.mint == tokenAccount.mint.toBase58();
        },
      );
      if (tokenConfig) {
        assert(!this.positions[tokenConfig.symbol]);
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

  async airdrop(symbol: string, amount: number): Promise<void> {
    const tokenConfig = Object.values<any>(this.config.tokens).find(
      tokenConfig => {
        return tokenConfig.symbol == symbol;
      },
    );
    assert(tokenConfig);

    if (!this.positions[symbol]) {
      const associatedTokenAddress: PublicKey = await getAssociatedTokenAddress(
        new PublicKey(tokenConfig.mint),
        this.owner!.publicKey, //TODO replace this with the margin account.
      );

      await sendAndConfirmTransaction(
        this.connection,
        new Transaction().add(
          createAssociatedTokenAccountInstruction(
            this.payer.publicKey,
            associatedTokenAddress,
            this.owner!.publicKey, //TODO replace this with the margin account.
            new PublicKey(tokenConfig.mint),
          ),
        ),
        [this.payer],
        {
          commitment: 'confirmed',
        },
      );

      this.positions[symbol] = new Position({
        balance: BigInt(0),
        decimals: tokenConfig.decimals,
        isNative: symbol == 'SOL', //TODO this is a hack.
        mint: new PublicKey(tokenConfig.mint),
        symbol: tokenConfig.symbol,
        tokenAccount: associatedTokenAddress,
      });
    }

    assert(this.positions[symbol]);
    const position = this.positions[symbol];

    assert(this.config.splTokenFaucet);
    assert(tokenConfig.faucet);

    await airdropTokens(
      this.connection,
      new PublicKey(this.config.splTokenFaucet),
      // @ts-ignore
      this.payer,
      new PublicKey(tokenConfig.faucet),
      position.tokenAccount,
      new BN(amount * 10 ** tokenConfig.decimals),
    );
  }

  async closeMarginAccount(): Promise<void> {
    //TODO
  }

  async deposit(mint: PublicKey, amount: number): Promise<void> {
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

  async stop(): Promise<void> {}

  async withdraw(mint: PublicKey, amount: number): Promise<void> {
    //TODO
  }
}
