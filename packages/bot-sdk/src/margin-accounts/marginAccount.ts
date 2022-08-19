import { BN } from '@project-serum/anchor';
import { DexInstructions, OpenOrders } from '@project-serum/serum';
import { ORDERBOOK_LAYOUT } from '@project-serum/serum/lib/market';
import {
  AccountLayout,
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Account,
  AccountInfo,
  Commitment,
  Context,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';

import {
  Configuration,
  MarketConfiguration,
  TokenConfiguration,
} from '../configuration';
import { Connection } from '../connection';
import { Market, Order } from '../markets/market';
import { getSerumError, SerumMarket } from '../markets/serum';
import { Position } from './position';

const ZERO_BN = new BN(0);

export abstract class MarginAccount {
  //address: PublicKey; //TODO
  configuration: Configuration;
  connection: Connection;
  //delegate?: Account; //TODO
  owner?: Account;
  payer?: Account;
  symbols?: string[];

  // Populated after load.
  loaded: boolean = false;
  markets: Record<string, Market> = {};
  payerBalance: number = 0;
  positions: Record<string, Position> = {};

  // Populated after listen.
  listening: boolean = false;

  constructor(
    cluster: string,
    verbose: boolean,
    keyfile?: string,
    symbols?: string[],
  ) {
    this.configuration = new Configuration(cluster, verbose, symbols);

    this.connection = new Connection(this.configuration.url, verbose);

    if (keyfile) {
      const account = new Account(
        JSON.parse(fs.readFileSync(keyfile, 'utf-8')),
      );
      this.owner = account;
      this.payer = account;

      //TODO
      //this.address = address;
      //this.delegate = delegate;
    }

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
        this.payer!,
        [position],
      );
      assert(position.tokenAccount);
      if (this.listening) {
        await position.listen(this.connection);
      }
    }

    assert(this.positions[symbol]);
    const position = this.positions[symbol];

    await position.airdrop(this.connection, this.payer!, amount);
  }

  async cancelOrders(): Promise<void> {
    assert(this.loaded);

    const transaction = new Transaction();
    for (const market of Object.values<Market>(this.markets)) {
      if (market instanceof SerumMarket) {
        if (market.openOrders) {
          for (let i = 0; i < market.openOrders.orders.length; i++) {
            const orderId = market.openOrders.orders[i];
            if (orderId.gt(ZERO_BN)) {
              const side = market.openOrders.isBidBits.testn(i)
                ? 'buy'
                : 'sell';
              const openOrdersSlot = i;
              if (this.configuration.verbose) {
                console.log(`  CANCEL ORDER`);
                console.log(
                  `    market         = ${market.marketConfiguration.symbol}`,
                );
                console.log(
                  `    openOrders     = ${market.openOrders.address}`,
                );
                console.log(`    side           = ${side}`);
                console.log(`    orderId        = ${orderId}`);
                console.log(`    openOrdersSlot = ${openOrdersSlot}`);
                console.log('');
              }
              transaction.add(
                DexInstructions.cancelOrderV2({
                  market: market.marketConfiguration.market,
                  owner: this.owner!.publicKey,
                  openOrders: market.openOrders.address,
                  bids: market.marketConfiguration.bids,
                  asks: market.marketConfiguration.asks,
                  eventQueue: market.marketConfiguration.eventQueue,
                  side,
                  orderId,
                  openOrdersSlot,
                  programId: this.configuration.serumProgramId,
                }),
              );
            }
          }
        }
      }
    }
    if (transaction.instructions.length > 0) {
      const result = await this.connection.sendAndConfirmTransaction(
        transaction,
        [this.owner!],
      );
      if (result.err) {
        const errorCode: number =
          result.err.valueOf()['InstructionError'][1]['Custom'];
        console.log(`SERUM ERROR: ${getSerumError(errorCode)}`);
      }
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
      await this.connection.sendAndConfirmTransaction(transaction, [
        this.owner!,
      ]);
    }

    //TODO close the margin account, transfer the tokens back to the user wallet.

    this.loaded = false;
  }

  async closeOpenOrders(): Promise<void> {
    await SerumMarket.closeOpenOrders(
      this.configuration,
      this.connection,
      this.owner!,
    );
  }

  async crank(): Promise<void> {
    for (const market of Object.values<Market>(this.markets)) {
      await market.crank();
    }
  }

  async createOpenOrders(): Promise<void> {
    assert(this.loaded);
    assert(!this.listening);

    await SerumMarket.createOpenOrders(
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
      this.payer!,
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
      this.payer!.publicKey,
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

    for (const market of Object.values<Market>(this.markets)) {
      await market.listen();
    }

    this.listening = true;
  }

  async load(): Promise<void> {
    assert(!this.loaded);

    this.payerBalance = await this.connection.getBalance(this.payer!.publicKey);

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
      const market = new SerumMarket(
        this.configuration,
        marketConfiguration,
        this.positions,
        this.connection,
        this.payer,
      );
      this.markets[marketConfiguration.symbol] = market;
    }
    await SerumMarket.load(
      this.connection,
      this.owner!.publicKey,
      this.configuration.serumProgramId,
      Object.values<Market>(this.markets),
    );

    this.loaded = true;
  }

  async printAsks(marketName: string, depth: number = 8): Promise<void> {
    console.log(`${marketName} ASK`);

    const marketConfiguration = this.configuration.markets[marketName];
    const accountInfo = await this.connection.getAccountInfo(
      marketConfiguration.asks,
    );
    if (accountInfo) {
      const { accountFlags, slab } = ORDERBOOK_LAYOUT.decode(accountInfo.data);
      const levels: [BN, BN][] = [];
      for (const { key, quantity } of slab.items(false)) {
        const price = key.ushrn(64);
        if (levels.length > 0 && levels[levels.length - 1][0].eq(price)) {
          levels[levels.length - 1][1] =
            levels[levels.length - 1][1].add(quantity);
        } else if (levels.length === depth) {
          break;
        } else {
          levels.push([price, quantity]);
        }
      }
      levels.forEach(([priceLots, sizeLots]) => {
        console.log(
          `  ${priceLotsToNumber(
            priceLots,
            marketConfiguration.baseLotSize,
            marketConfiguration.baseDecimals,
            marketConfiguration.quoteLotSize,
            marketConfiguration.quoteDecimals,
          )}  |  ${baseSizeLotsToNumber(
            sizeLots,
            marketConfiguration.baseLotSize,
            marketConfiguration.baseDecimals,
          )}`,
        );
      });
    }
  }

  async printAskOrders(marketName: string, depth: number = 8): Promise<void> {
    console.log(`${marketName} ASK ORDERS`);

    const marketConfiguration = this.configuration.markets[marketName];
    const accountInfo = await this.connection.getAccountInfo(
      marketConfiguration.asks,
    );
    if (accountInfo) {
      const { accountFlags, slab } = ORDERBOOK_LAYOUT.decode(accountInfo.data);

      for (const {
        key,
        ownerSlot,
        owner,
        quantity,
        feeTier,
        clientOrderId,
      } of slab.items(true)) {
        const priceLots = key.ushrn(64);

        console.log(`  ORDER`);
        console.log(`    orderId = ${key}`);
        console.log(`    owner = ${owner}`);
        console.log(`    ownerSlot = ${ownerSlot}`);
        console.log(`    feeTier = ${feeTier}`);
        console.log(`    clientOrderId = ${clientOrderId}`);
        console.log(
          `    price = ${priceLotsToNumber(
            priceLots,
            marketConfiguration.baseLotSize,
            marketConfiguration.baseDecimals,
            marketConfiguration.quoteLotSize,
            marketConfiguration.quoteDecimals,
          )}`,
        );
        console.log(
          `    quantity = ${baseSizeLotsToNumber(
            quantity,
            marketConfiguration.baseLotSize,
            marketConfiguration.baseDecimals,
          )}`,
        );
        console.log('');
      }
    }
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

  async printBids(marketName: string, depth: number = 8): Promise<void> {
    console.log(`${marketName} BID`);

    const marketConfiguration = this.configuration.markets[marketName];
    const accountInfo = await this.connection.getAccountInfo(
      marketConfiguration.bids,
    );
    if (accountInfo) {
      const { accountFlags, slab } = ORDERBOOK_LAYOUT.decode(accountInfo.data);
      const levels: [BN, BN][] = [];
      for (const { key, quantity } of slab.items(true)) {
        const price = key.ushrn(64);
        if (levels.length > 0 && levels[levels.length - 1][0].eq(price)) {
          levels[levels.length - 1][1] =
            levels[levels.length - 1][1].add(quantity);
        } else if (levels.length === depth) {
          break;
        } else {
          levels.push([price, quantity]);
        }
      }
      levels.forEach(([priceLots, sizeLots]) => {
        console.log(
          `  ${priceLotsToNumber(
            priceLots,
            marketConfiguration.baseLotSize,
            marketConfiguration.baseDecimals,
            marketConfiguration.quoteLotSize,
            marketConfiguration.quoteDecimals,
          )}  |  ${baseSizeLotsToNumber(
            sizeLots,
            marketConfiguration.baseLotSize,
            marketConfiguration.baseDecimals,
          )}`,
        );
      });
    }
  }

  async printBidOrders(marketName: string, depth: number = 8): Promise<void> {
    console.log(`${marketName} BID ORDERS`);

    const marketConfiguration = this.configuration.markets[marketName];
    const accountInfo = await this.connection.getAccountInfo(
      marketConfiguration.bids,
    );
    if (accountInfo) {
      const { accountFlags, slab } = ORDERBOOK_LAYOUT.decode(accountInfo.data);

      for (const {
        key,
        ownerSlot,
        owner,
        quantity,
        feeTier,
        clientOrderId,
      } of slab.items(true)) {
        const priceLots = key.ushrn(64);

        console.log(`  ORDER`);
        console.log(`    orderId = ${key}`);
        console.log(`    owner = ${owner}`);
        console.log(`    ownerSlot = ${ownerSlot}`);
        console.log(`    feeTier = ${feeTier}`);
        console.log(`    clientOrderId = ${clientOrderId}`);
        console.log(
          `    price = ${priceLotsToNumber(
            priceLots,
            marketConfiguration.baseLotSize,
            marketConfiguration.baseDecimals,
            marketConfiguration.quoteLotSize,
            marketConfiguration.quoteDecimals,
          )}`,
        );
        console.log(
          `    quantity = ${baseSizeLotsToNumber(
            quantity,
            marketConfiguration.baseLotSize,
            marketConfiguration.baseDecimals,
          )}`,
        );
        console.log('');
      }
    }
  }

  printOpenOrders(): void {
    assert(this.loaded);
    for (const market of Object.values<Market>(this.markets)) {
      if (market instanceof SerumMarket) {
        console.log(market.marketConfiguration.symbol);
        if (market.openOrders) {
          console.log(`  address = ${market.openOrders.address}`);
          console.log(
            `  baseTokenTotal = ${market.openOrders.baseTokenTotal.toNumber()}`,
          );
          console.log(
            `  baseTokenFree = ${market.openOrders.baseTokenFree.toNumber()}`,
          );
          console.log(
            `  quoteTokenTotal = ${market.openOrders.quoteTokenTotal.toNumber()}`,
          );
          console.log(
            `  quoteTokenFree = ${market.openOrders.quoteTokenFree.toNumber()}`,
          );
          console.log('');

          for (let i = 0; i < market.openOrders.orders.length; i++) {
            const orderId = market.openOrders.orders[i];
            if (
              orderId.gt(ZERO_BN) &&
              !market.openOrders.freeSlotBits.testn(i)
            ) {
              console.log(
                `  openOrdersSlot = ${i}, orderId = ${orderId}, side = ${
                  market.openOrders.isBidBits.testn(i) ? 'buy' : 'sell'
                }`,
              );
            }
          }
        }
      }
      console.log('');
    }
  }

  async refreshOpenOrders(): Promise<void> {
    const publicKeys: PublicKey[] = [];
    for (const market of Object.values<Market>(this.markets)) {
      if (market instanceof SerumMarket) {
        if (market.openOrders) {
          publicKeys.push(market.openOrders.address);
        }
      }
    }

    const openOrdersAccounts = await this.connection.getMultipleAccountsInfo(
      publicKeys,
    );

    for (const market of Object.values<Market>(this.markets)) {
      if (market instanceof SerumMarket) {
        if (market.openOrders) {
          const publicKey = publicKeys.shift();
          assert(publicKey);
          const openOrdersAccount = openOrdersAccounts.shift();
          assert(openOrdersAccount);
          market.openOrders = OpenOrders.fromAccountInfo(
            publicKey,
            openOrdersAccount,
            this.configuration.serumProgramId,
          );
        }
      }
    }
  }

  sendOrders(orders: Order[]): void {
    assert(this.loaded);

    (async () => {
      try {
        const transaction = new Transaction();

        for (const order of orders) {
          if (order.price == 0 || order.size == 0) {
            continue;
          }

          const market = this.markets[order.symbol];
          if (market && market instanceof SerumMarket) {
            if (!market.openOrders) {
              await SerumMarket.createOpenOrders(
                this.configuration,
                this.connection,
                this.owner!,
                [market],
              );
              if (this.listening) {
                await market.listenOpenOrders();
              }
            }
            assert(market.openOrders);

            const priceLots = market.market!.priceNumberToLots(order.price);
            const sizeLots = market.market!.baseSizeNumberToLots(order.size);

            let baseQuantity = sizeLots;
            let quoteQuantity = new BN(
              market.marketConfiguration.quoteLotSize,
            ).mul(sizeLots.mul(priceLots));

            // Clip the order to what is in the wallet.
            if (order.side == 'buy') {
              quoteQuantity = BN.min(
                quoteQuantity,
                new BN(Number(market.quotePosition.balance)),
              );
            } else {
              baseQuantity = BN.min(
                baseQuantity,
                new BN(Number(market.basePosition.balance)),
              );
            }

            let orderExists = false;

            for (let i = 0; i < market.openOrders.orders.length; i++) {
              const orderId = market.openOrders.orders[i];
              if (orderId.gt(ZERO_BN)) {
                const price = orderId.ushrn(64);
                if (price.eq(priceLots)) {
                  orderExists = true;
                  break;
                }
              }
            }

            if (
              !orderExists &&
              baseQuantity.gt(ZERO_BN) &&
              quoteQuantity.gt(ZERO_BN)
            ) {
              assert(market.basePosition);
              assert(market.basePosition.tokenAccount);
              assert(market.quotePosition);
              assert(market.quotePosition.tokenAccount);

              if (this.configuration.verbose) {
                console.log(`  SEND ORDER`);
                console.log(`    order.clientId  = ${order.clientId}`);
                console.log(`    order.orderType = ${order.orderType}`);
                console.log(`    order.price     = ${order.price}`);
                console.log(`    order.side      = ${order.side}`);
                console.log(`    order.size      = ${order.size}`);
                console.log(`    order.symbol    = ${order.symbol}`);
                console.log('');
              }

              transaction.add(
                DexInstructions.newOrderV3({
                  market: market.market!.address,
                  bids: market.marketConfiguration.bids,
                  asks: market.marketConfiguration.asks,
                  requestQueue: market.marketConfiguration.requestQueue,
                  eventQueue: market.marketConfiguration.eventQueue,
                  baseVault: market.marketConfiguration.baseVault,
                  quoteVault: market.marketConfiguration.quoteVault,
                  openOrders: market.openOrders!.address,
                  owner: this.owner!.publicKey,
                  payer:
                    order.side == 'buy'
                      ? market.quotePosition.tokenAccount
                      : market.basePosition.tokenAccount,
                  side: order.side,
                  limitPrice: priceLots,
                  maxBaseQuantity: baseQuantity,
                  maxQuoteQuantity: quoteQuantity,
                  orderType: order.orderType,
                  clientId: order.clientId,
                  programId: market.market!.programId,
                  selfTradeBehavior: order.selfTradeBehavior,
                  //feeDiscountPubkey: feeDiscountPubkey, //TODO
                  //maxTs, //TODO
                  //replaceIfExists, //TODO
                }),
              );
            }
          } else {
            console.log(`Unknown market: ${order.symbol}`);
          }
        }

        if (transaction.instructions.length > 0) {
          const result = await this.connection.sendAndConfirmTransaction(
            transaction,
            [this.owner!, this.payer!],
          );
          if (result.err) {
            const errorCode: number =
              result.err.valueOf()['InstructionError'][1]['Custom'];
            console.log(`SERUM ERROR: ${getSerumError(errorCode)}`);
          }
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
          market: 'serum',
          symbol: marketName,
          clientId: new BN(Date.now()),
          orderType: 'limit',
          price,
          selfTradeBehavior: 'abortTransaction',
          side: 'sell',
          size,
        },
      ]);
    } else if (
      position.tokenConfiguration.symbol ==
      market.marketConfiguration.quoteSymbol
    ) {
      this.sendOrders([
        {
          market: 'serum',
          symbol: marketName,
          clientId: new BN(Date.now()),
          orderType: 'limit',
          price,
          selfTradeBehavior: 'abortTransaction',
          side: 'buy',
          size,
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
    await SerumMarket.settleFunds(this.connection, this.owner!, markets);
  }

  async withdraw(symbol: string, amount: number): Promise<void> {
    assert(this.loaded);
    //TODO
    throw new Error('Implement');
  }
}

function baseSizeLotsToNumber(
  size: BN,
  baseLotSize: number,
  baseSplTokenDecimals: number,
) {
  return divideBnToNumber(
    size.mul(new BN(baseLotSize)),
    baseSplTokenMultiplier(baseSplTokenDecimals),
  );
}

function priceLotsToNumber(
  price: BN,
  baseLotSize: number,
  baseSplTokenDecimals: number,
  quoteLotSize: number,
  quoteSplTokenDecimals: number,
) {
  return divideBnToNumber(
    price
      .mul(new BN(quoteLotSize))
      .mul(baseSplTokenMultiplier(baseSplTokenDecimals)),
    new BN(baseLotSize).mul(quoteSplTokenMultiplier(quoteSplTokenDecimals)),
  );
}

function baseSplTokenMultiplier(baseSplTokenDecimals: number) {
  return new BN(10).pow(new BN(baseSplTokenDecimals));
}

function quoteSplTokenMultiplier(quoteSplTokenDecimals: number) {
  return new BN(10).pow(new BN(quoteSplTokenDecimals));
}

function divideBnToNumber(numerator: BN, denominator: BN): number {
  const quotient = numerator.div(denominator).toNumber();
  const rem = numerator.umod(denominator);
  const gcd = rem.gcd(denominator);
  return quotient + rem.div(gcd).toNumber() / denominator.div(gcd).toNumber();
}
