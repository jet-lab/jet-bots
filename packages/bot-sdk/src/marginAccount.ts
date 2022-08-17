import { BN } from '@project-serum/anchor';
import { DexInstructions } from '@project-serum/serum';
import {
  AccountLayout,
  createCloseAccountInstruction,
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
import * as fs from 'fs';

import {
  Configuration,
  MarketConfiguration,
  TokenConfiguration,
} from './configuration';
import { Market, Order } from './market';
import { Position } from './position';

export class MarginAccount {
  //address: PublicKey;
  configuration: Configuration;
  connection: Connection;
  //delegate?: Account;
  owner?: Account;
  payer: Account;
  serumProgramId: PublicKey;
  symbols?: string[];

  // Populated after load.
  loaded: boolean = false;
  markets: Record<string, Market> = {};
  payerBalance: number = 0;
  positions: Record<string, Position> = {};

  // Populated after listen.
  listening: boolean = false;

  constructor(cluster: string, keyfile: string, symbols?: string[]) {
    const configuration = new Configuration(cluster, symbols);
    const connection = new Connection(
      configuration.url,
      'processed' as Commitment,
    );
    const account = new Account(JSON.parse(fs.readFileSync(keyfile, 'utf-8')));

    //this.address = address;
    this.configuration = configuration;
    this.connection = connection;
    //this.delegate = delegate;
    this.owner = account;
    this.payer = account;
    this.serumProgramId = this.configuration.serumProgramId;
    this.symbols = symbols;
  }

  async airdrop(symbol: string, amount: number): Promise<void> {
    assert(this.loaded);

    const tokenConfiguration = Object.values<TokenConfiguration>(
      this.configuration.tokens,
    ).find(tokenConfiguration => {
      return tokenConfiguration.symbol == symbol;
    });
    assert(tokenConfiguration);

    if (!this.positions[symbol].tokenAccount) {
      const position = this.positions[symbol];
      await Position.createTokenAccounts(
        this.connection,
        this.owner!,
        this.payer,
        [position],
      );
      assert(position.tokenAccount);
      if (this.listening) {
        await position.listen(this.connection);
      }
    }

    assert(this.positions[symbol]);
    const position = this.positions[symbol];

    await position.airdrop(this.connection, this.payer, amount);
  }

  async cancelOrders(): Promise<void> {
    assert(this.loaded);

    const ZERO_BN = new BN(0);

    const transaction = new Transaction();
    for (const market of Object.values<Market>(this.markets)) {
      if (market.openOrders) {
        for (let i = 0; i < market.openOrders.orders.length; i++) {
          const orderId = market.openOrders.orders[i];
          if (orderId.gt(ZERO_BN)) {
            transaction.add(
              DexInstructions.cancelOrderV2({
                market: market.marketConfiguration.market,
                bids: market.marketConfiguration.bids,
                asks: market.marketConfiguration.asks,
                eventQueue: market.marketConfiguration.eventQueue,
                openOrders: market.openOrders.address,
                owner: this.owner!.publicKey,
                side: market.openOrders.isBidBits.testn(i) ? 'buy' : 'sell',
                orderId,
                openOrdersSlot: i,
                programId: this.configuration.serumProgramId,
              }),
            );
          }
        }
      }
    }
    if (transaction.instructions.length > 0) {
      const txid = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.owner!],
      );
      console.log(txid);
    }
  }

  async closeMarginAccount(): Promise<void> {
    assert(this.loaded);

    await this.cancelOrders();

    await this.settleFunds();

    await this.closeOpenOrders();

    const transaction = new Transaction();
    for (const position of Object.values<Position>(this.positions)) {
      if (position.tokenAccount && Number(position.balance) == 0) {
        transaction.add(
          createCloseAccountInstruction(
            position.tokenAccount,
            this.owner!.publicKey,
            this.owner!.publicKey,
          ),
        );
      }
    }
    if (transaction.instructions.length > 0) {
      const txid = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.owner!],
      );
      console.log(txid);
    }

    //TODO close the margin account, transfer the tokens back to the user wallet.

    this.loaded = false;
  }

  async closeOpenOrders(): Promise<void> {
    await Market.closeOpenOrders(
      this.configuration,
      this.connection,
      this.owner!,
    );
  }

  static async createMarginAccount(
    cluster: string,
    keyfile: string,
  ): Promise<void> {
    //TODO create a margin account.

    const marginAccount = new MarginAccount(cluster, keyfile);
    await marginAccount.load();
    await marginAccount.createTokenAccounts();
    await marginAccount.createOpenOrders();
  }

  async createOpenOrders(): Promise<void> {
    assert(this.loaded);
    assert(!this.listening);

    await Market.createOpenOrders(
      this.configuration,
      this.connection,
      this.owner!,
      Object.values<Market>(this.markets),
    );
  }

  async createTokenAccounts(): Promise<void> {
    assert(this.loaded);
    assert(!this.listening);
    await Position.createTokenAccounts(
      this.connection,
      this.owner!,
      this.payer,
      Object.values<Position>(this.positions),
    );
  }

  async deposit(symbol: string, amount: number): Promise<void> {
    assert(this.loaded);

    //TODO
    throw new Error('Implement');
  }

  async listen(): Promise<void> {
    assert(this.loaded);
    assert(!this.listening);

    this.connection.onAccountChange(
      this.payer.publicKey,
      (accountInfo: AccountInfo<Buffer>, context: Context) => {
        this.payerBalance = accountInfo.lamports;
      },
      'confirmed' as Commitment,
    );

    for (const position of Object.values<Position>(this.positions)) {
      if (position.tokenAccount) {
        await position.listen(this.connection);
      }
    }

    await this.listenOpenOrders();

    this.listening = true;
  }

  async listenOpenOrders(): Promise<void> {
    assert(this.loaded);
    assert(!this.listening);
    const markets = Object.values<Market>(this.markets);
    assert(markets.length > 0);
    for (const market of markets) {
      if (market.openOrders) {
        await market.listenOpenOrders(this.configuration, this.connection);
      }
    }
  }

  async load(): Promise<void> {
    assert(!this.loaded);

    this.payerBalance = await this.connection.getBalance(this.payer.publicKey);

    const response = await this.connection.getTokenAccountsByOwner(
      this.owner!.publicKey, //TODO replace account with a trading account, this.address,
      {
        programId: TOKEN_PROGRAM_ID,
      },
    );
    for (const item of response.value) {
      const tokenAccount = AccountLayout.decode(Buffer.from(item.account.data));
      const tokenConfiguration = Object.values<TokenConfiguration>(
        this.configuration.tokens,
      ).find(tokenConfig => {
        return tokenConfig.mint.toBase58() == tokenAccount.mint.toBase58();
      });
      if (tokenConfiguration) {
        assert(
          tokenConfiguration.mint.toBase58() == tokenAccount.mint.toBase58(),
        );
        this.positions[tokenConfiguration.symbol] = new Position(
          this.configuration,
          tokenConfiguration,
          item.pubkey,
          tokenAccount.amount,
        );
      }
    }

    for (const tokenConfiguration of Object.values<TokenConfiguration>(
      this.configuration.tokens,
    )) {
      if (!this.positions[tokenConfiguration.symbol]) {
        this.positions[tokenConfiguration.symbol] = new Position(
          this.configuration,
          tokenConfiguration,
        );
      }
    }

    for (const marketConfiguration of Object.values<MarketConfiguration>(
      this.configuration.markets,
    )) {
      const market = new Market(
        this.configuration,
        marketConfiguration,
        this.positions,
      );
      this.markets[marketConfiguration.symbol] = market;
    }
    await Market.load(
      this.connection,
      this.owner!.publicKey,
      this.serumProgramId,
      Object.values<Market>(this.markets),
    );

    this.loaded = true;
  }

  printBalance(): void {
    assert(this.loaded);

    console.log(
      `  Payer balance = ${(this.payerBalance / LAMPORTS_PER_SOL).toFixed(
        2,
      )} SOL`,
    );
    console.log('');
    for (const position of Object.values<Position>(this.positions)) {
      if (position.tokenAccount) {
        console.log(
          `  ${position.tokenConfiguration.symbol} token balance = ${(
            Number(position.balance) /
            10 ** position.tokenConfiguration.decimals
          ).toFixed(position.tokenConfiguration.precision)}`,
        );
      }
    }
    console.log('');
  }

  printOpenOrders(): void {
    assert(this.loaded);
    for (const market of Object.values<Market>(this.markets)) {
      console.log(market.marketConfiguration.symbol);
      if (market.openOrders) {
        console.log(`  address = ${market.openOrders.address}`);
        console.log(
          `  baseTokenFree = ${market.openOrders.baseTokenFree.toNumber()}`,
        );
        console.log(
          `  quoteTokenFree = ${market.openOrders.quoteTokenFree.toNumber()}`,
        );
        console.log('');

        const ZERO_BN = new BN(0);

        for (let i = 0; i < market.openOrders.orders.length; i++) {
          const orderId = market.openOrders.orders[i];
          if (orderId.gt(ZERO_BN)) {
            console.log(
              `  openOrdersSlot = ${i}, orderId = ${orderId}, side = ${
                market.openOrders.isBidBits.testn(i) ? 'buy' : 'sell'
              }`,
            );
          }
        }
      }
      console.log('');
    }
  }

  sendOrders(orders: Order[]): void {
    assert(this.loaded);

    (async () => {
      try {
        const transaction = new Transaction();

        for (const order of orders) {
          const market = this.markets[order.symbol];
          if (market) {
            if (!market.openOrders) {
              await Market.createOpenOrders(
                this.configuration,
                this.connection,
                this.owner!,
                [market],
              );
              if (this.listening) {
                await market.listenOpenOrders(
                  this.configuration,
                  this.connection,
                );
              }
            }
            assert(market.openOrders);

            if (
              market.market!.baseSizeNumberToLots(order.size).lte(new BN(0))
            ) {
              console.log(`size = ${order.size}`);
              console.log(
                `market.baseSizeNumberToLots(size) = ${market.market!.baseSizeNumberToLots(
                  order.size,
                )}`,
              );
              console.log('size too small');
            } else if (
              market.market!.priceNumberToLots(order.price).lte(new BN(0))
            ) {
              console.log(`price = ${order.price}`);
              console.log(
                `market.priceNumberToLots(price) = ${market.market!.priceNumberToLots(
                  order.price,
                )}`,
              );
              console.log('invalid price');
            } else {
              transaction.add(
                market.market!.makeNewOrderV3Instruction({
                  owner: this.owner!,
                  payer: this.payer.publicKey,
                  side: order.side,
                  price: order.price,
                  size: order.size,
                  orderType: order.orderType,
                  clientId: order.clientId,
                  openOrdersAddressKey: market.openOrders!.address,
                  //feeDiscountPubkey,
                  selfTradeBehavior: order.selfTradeBehavior,
                  programId: market.market?.programId,
                  //maxTs,
                  replaceIfExists: true,
                }),
              );
            }
          } else {
            console.log(`Unknown market: ${order.symbol}`);
          }
        }

        if (transaction.instructions.length > 0) {
          const txid = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [this.payer],
            {
              skipPreflight: true,
              commitment: 'processed',
            },
          );
          console.log(txid);
        }
      } catch (err) {
        console.log(`ERROR: ${JSON.stringify(err)}`);
      }
    })();
  }

  sendTestOrder(
    marketName: string,
    token: string,
    price: number,
    size: number,
  ): void {
    assert(
      this.configuration.cluster == 'devnet' ||
        this.configuration.cluster == 'localnet',
    );
    assert(this.loaded);

    const market = this.markets[marketName];
    const position = this.positions[token];

    if (
      position.tokenConfiguration.symbol ==
      market.marketConfiguration.baseSymbol
    ) {
      this.sendOrders([
        {
          symbol: marketName,
          clientId: new BN(Date.now()),
          side: 'sell',
          price,
          size,
          orderType: 'limit',
          selfTradeBehavior: 'abortTransaction',
        },
      ]);
    } else if (
      position.tokenConfiguration.symbol ==
      market.marketConfiguration.quoteSymbol
    ) {
      this.sendOrders([
        {
          symbol: marketName,
          clientId: new BN(Date.now()),
          side: 'buy',
          price,
          size,
          orderType: 'limit',
          selfTradeBehavior: 'abortTransaction',
        },
      ]);
    } else {
      throw new Error(
        `Token '${token}' does not belong to market '${marketName}'.`,
      );
    }
  }

  async setLimits(
    symbol: string,
    minAmount: number,
    maxAmount: number,
  ): Promise<void> {
    //console.log(`minAmount = ${minAmount}`);
    //console.log(`maxAmount = ${maxAmount}`);
    assert(minAmount <= maxAmount);

    const position = this.positions[symbol];
    assert(position);
    position.minAmount = minAmount;
    position.maxAmount = maxAmount;

    //TODO write this to the user's margin account settings on-chain.
  }

  async settleFunds(): Promise<void> {
    assert(this.loaded);
    const markets = Object.values<Market>(this.markets);
    assert(markets.length > 0);
    await Market.settleFunds(this.connection, this.owner!, markets);
  }

  async withdraw(symbol: string, amount: number): Promise<void> {
    assert(this.loaded);
    //TODO
    throw new Error('Implement');
  }
}
