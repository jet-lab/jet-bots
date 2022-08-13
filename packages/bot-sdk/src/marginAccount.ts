import { BN } from '@project-serum/anchor';
import { OpenOrders } from '@project-serum/serum';
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
import { findOpenOrdersAccountsForOwner } from './serum';
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

  static async createMarginAccount(params: {
    config: any;
    connection: Connection;
    owner: Account;
    payer: Account;
  }): Promise<MarginAccount> {
    //TODO
    throw new Error('Implement.');
  }

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

    const serumProgramId = new PublicKey(this.config.serumProgramId);

    const openOrdersAccounts = await findOpenOrdersAccountsForOwner(
      this.connection,
      this.owner!.publicKey,
      serumProgramId,
    );

    for (const openOrdersAccount of openOrdersAccounts) {
      console.log(
        `openOrdersAccount.publicKey = ${openOrdersAccount.publicKey}`,
      );

      const openOrders = OpenOrders.fromAccountInfo(
        openOrdersAccount.publicKey,
        openOrdersAccount.accountInfo,
        serumProgramId,
      );

      //TODO set this on the token account.
    }
  }

  async listen(): Promise<void> {
    this.connection.onAccountChange(
      this.payer.publicKey,
      (accountInfo: AccountInfo<Buffer>, context: Context) => {
        this.payerBalance = accountInfo.lamports;
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

    //TODO subscribe to open orders.

    /*
if (
  openOrders.baseTokenFree.gt(new BN(0)) ||
  openOrders.quoteTokenFree.gt(new BN(0))
) {
  await context.bots[i].positions[symbol].settleFunds();
}
*/
  }

  async airdrop(symbol: string, amount: number): Promise<void> {
    const tokenConfig = Object.values<any>(this.config.tokens).find(
      tokenConfig => {
        return tokenConfig.symbol == symbol;
      },
    );
    assert(tokenConfig);

    if (!this.positions[symbol]) {
      this.positions[symbol] = await Position.create(
        this.connection,
        this.owner!.publicKey,
        this.payer,
        tokenConfig,
      );
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

  cancelOrders(): void {
    //TODO for every position cancel the orders.
    /*
  async cancelOpenOrders() {
    for (const market of Object.values<Market>(this.context.markets)) {
      const openOrders = await market.loadOrdersForOwner(
        this.context.connection,
        this.context.account!.publicKey,
      );
      for (const openOrder of openOrders) {
        await market.cancelOrder(this.context.connection, this.context.account!, openOrder);
      }
    }
  }
    */
    //throw new Error('Implement.');
  }

  async closeMarginAccount(): Promise<void> {
    //TODO
    //await this.closeOpenOrdersAccounts();

    throw new Error('Implement.');
  }

  async deposit(symbol: string, amount: number): Promise<void> {
    //TODO
  }

  printBalance(): void {
    console.log('');
    console.log(
      `Payer balance = ${(this.payerBalance / LAMPORTS_PER_SOL).toFixed(
        2,
      )} SOL`,
    );
    for (const position of Object.values<Position>(this.positions)) {
      console.log(
        `  ${position.symbol} token balance = ${(
          Number(position.balance) /
          10 ** position.decimals
        ).toFixed(2)}`,
      );
    }
    console.log('');
  }

  printOpenOrders(): void {
    throw new Error('Implement.');
  }

  sendOrders(orders: any[]): void {
    async () => {
      try {
        console.log(JSON.stringify(orders));
        console.log('');

        //TODO if open orders account is null, create one and subscribe to events.
        //createOpenOrdersAccount

        //TODO replace existing orders.
        //replaceOrdersByClientIds

        //TODO send the orders.
        //owner: this.account,
        //payer: this.context.positions[symbol].quoteTokenAccount,
        //clientId: undefined,
        //openOrdersAddressKey: this.context.positions[symbol].openOrdersAccount,
        //feeDiscountPubkey: this.feeDiscountPubkey,
        /*
        export interface OrderParamsBase<T = Account> {
            side: 'buy' | 'sell';
            price: number;
            size: number;
            orderType?: 'limit' | 'ioc' | 'postOnly';
            clientId?: BN;
            selfTradeBehavior?: 'decrementTake' | 'cancelProvide' | 'abortTransaction' | undefined;
            maxTs?: number | null;
        }
        export interface OrderParamsAccounts<T = Account> {
            owner: T;
            payer: PublicKey;
            openOrdersAddressKey?: PublicKey;
            openOrdersAccount?: Account;
            feeDiscountPubkey?: PublicKey | null;
            programId?: PublicKey;
        }
        export interface OrderParams<T = Account> extends OrderParamsBase<T>, OrderParamsAccounts<T> {
            replaceIfExists?: boolean;
        }
        */
      } catch (err) {}
    };
  }

  async setLimits(
    symbol: string,
    minAmount: number,
    maxAmount: number,
  ): Promise<void> {
    //console.log(`minAmount = ${minAmount}`);
    //console.log(`maxAmount = ${maxAmount}`);
    assert(minAmount <= maxAmount);

    let position = this.positions[symbol];
    if (!position) {
      const tokenConfig = Object.values<any>(this.config.tokens).find(
        tokenConfig => {
          return tokenConfig.symbol == symbol;
        },
      );
      position = await Position.create(
        this.connection,
        this.owner!.publicKey,
        this.payer,
        tokenConfig,
      );
      this.positions[symbol] = position;
    }

    position.minAmount = minAmount;
    position.maxAmount = maxAmount;

    //TODO write this to the user's margin account settings.
  }

  async withdraw(symbol: string, amount: number): Promise<void> {
    //TODO
  }
}
