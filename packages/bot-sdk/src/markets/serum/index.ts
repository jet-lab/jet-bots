import { BN } from '@project-serum/anchor';
import {
  DexInstructions,
  Market as SpotMarket,
  OpenOrders,
  Orderbook,
} from '@project-serum/serum';
import { MARKET_STATE_LAYOUT_V2 } from '@project-serum/serum/lib/market';
import {
  decodeEventsSince,
  decodeEventQueue,
  Event,
} from '@project-serum/serum/lib/queue';
import {
  Account,
  AccountInfo,
  Commitment,
  Context,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import assert from 'assert';

import { Configuration, MarketConfiguration } from '../../configuration';
import { Connection } from '../../connection';
import { Position } from '../../margin-accounts/position';
import { Market } from '../market';

export class SerumMarket extends Market {
  market?: SpotMarket;
  asks?: Orderbook;
  bids?: Orderbook;
  events: Event[] = [];
  seqNum: number = 0;

  openOrders?: OpenOrders;

  // This is used when we want to run our own crank.
  payer?: Account;
  eventsBuffer?: Buffer;
  hasEvents: boolean = false;

  constructor(
    configuration: Configuration,
    marketConfiguration: MarketConfiguration,
    positions: Record<string, Position>,
    connection: Connection,
    payer?: Account,
  ) {
    super(configuration, marketConfiguration, positions, connection);
    this.payer = payer;
  }

  static async closeOpenOrders(
    configuration: Configuration,
    connection: Connection,
    owner: Account,
  ): Promise<void> {
    const transaction = new Transaction();
    const openOrdersAccounts = await findOpenOrdersAccountsForOwner(
      connection,
      owner.publicKey,
      configuration.serumProgramId,
    );
    for (const openOrdersAccount of openOrdersAccounts) {
      const openOrders = OpenOrders.fromAccountInfo(
        openOrdersAccount.publicKey,
        openOrdersAccount.accountInfo,
        configuration.serumProgramId,
      );
      let hasOrders = false;
      openOrders.orders.forEach(orderId => {
        if (!orderId.eq(new BN(0))) hasOrders = true;
      });
      if (hasOrders) {
        if (configuration.verbose) {
          console.log(
            `OpenOrders account still has open orders: ${openOrdersAccount.publicKey}`,
          );
        }
        continue;
      }

      if (
        Number(openOrders.baseTokenFree) > 0 ||
        Number(openOrders.quoteTokenFree) > 0
      ) {
        const marketConfig = Object.values<MarketConfiguration>(
          configuration.markets,
        ).find(marketConfig => {
          return marketConfig.market.toBase58() == openOrders.market.toBase58();
        });
        if (marketConfig) {
          if (configuration.verbose) {
            console.log(
              `OpenOrders account still has unsettled funds: ${openOrdersAccount.publicKey}`,
            );
          }
        }
        continue;
      } else {
        transaction.add(
          DexInstructions.closeOpenOrders({
            market: new PublicKey(openOrders.market),
            openOrders: openOrdersAccount.publicKey,
            owner: owner.publicKey,
            solWallet: owner.publicKey,
            programId: configuration.serumProgramId,
          }),
        );
      }
    }
    if (transaction.instructions.length > 0) {
      const result = await connection.sendAndConfirmTransaction(transaction, [
        owner,
      ]);
      if (result.err) {
        const errorCode: number =
          result.err.valueOf()['InstructionError'][1]['Custom'];
        console.log(`SERUM ERROR: ${getSerumError(errorCode)}`);
      }
    }
  }

  async crank(): Promise<void> {
    const consumeEventsLimit = 10;
    const transaction = new Transaction();
    const basePosition = this.basePosition;
    const quotePosition = this.quotePosition;
    if (basePosition.tokenAccount && quotePosition.tokenAccount) {
      if (this.hasEvents) {
        assert(this.eventsBuffer);
        const events = decodeEventQueue(this.eventsBuffer);
        if (events.length > 0) {
          const accounts: Set<PublicKey> = new Set();
          for (const event of events) {
            if (this.configuration.verbose) {
              console.log(`consumeEvents ${event.openOrders}`);
            }
            accounts.add(event.openOrders);
            if (accounts.size >= consumeEventsLimit) break;
            const openOrdersAccounts = [...accounts]
              .map(s => new PublicKey(s))
              .sort((a, b) =>
                a.toBuffer().swap64().compare(b.toBuffer().swap64()),
              );
            transaction.add(
              DexInstructions.consumeEvents({
                market: this.marketConfiguration.market,
                eventQueue: this.marketConfiguration.eventQueue,
                coinFee: basePosition.tokenAccount,
                pcFee: quotePosition.tokenAccount,
                openOrdersAccounts,
                limit: new BN(consumeEventsLimit),
                programId: this.configuration.serumProgramId,
              }),
            );
          }
        }
        this.hasEvents = false;
      }
    }
    if (transaction.instructions.length > 0) {
      transaction.feePayer = this.payer!.publicKey;
      await this.connection.sendTransaction(transaction, [this.payer!]);
    }
  }

  static async createOpenOrders(
    configuration: Configuration,
    connection: Connection,
    owner: Account,
    markets: Market[],
  ): Promise<void> {
    const publicKeys: PublicKey[] = [];
    const transaction = new Transaction();
    const signers: Account[] = [];
    for (const market of markets) {
      assert(market.marketConfiguration);
      if (market instanceof SerumMarket) {
        assert(market.market);
        if (!market.openOrders) {
          const openOrdersAccount = new Account();
          publicKeys.push(openOrdersAccount.publicKey);
          transaction.add(
            await OpenOrders.makeCreateAccountTransaction(
              connection,
              market.market.address,
              owner.publicKey,
              openOrdersAccount.publicKey,
              configuration.serumProgramId,
            ),
            DexInstructions.initOpenOrders({
              market: market.market!.address,
              openOrders: openOrdersAccount.publicKey,
              owner: owner.publicKey,
              programId: configuration.serumProgramId,
              marketAuthority: undefined,
            }),
          );
          signers.push(owner);
          signers.push(openOrdersAccount);
        }
      }
    }
    if (transaction.instructions.length > 0) {
      const result = await connection.sendAndConfirmTransaction(
        transaction,
        signers,
      );
      if (result.err) {
        const errorCode: number =
          result.err.valueOf()['InstructionError'][1]['Custom'];
        console.log(`SERUM ERROR: ${getSerumError(errorCode)}`);
      }
    }

    const openOrdersAccounts = await connection.getMultipleAccountsInfo(
      publicKeys,
    );

    for (const market of markets) {
      if (market instanceof SerumMarket) {
        assert(market.market);
        if (!market.openOrders) {
          const publicKey = publicKeys.shift();
          assert(publicKey);
          const openOrdersAccount = openOrdersAccounts.shift();
          assert(openOrdersAccount);
          market.openOrders = OpenOrders.fromAccountInfo(
            publicKey,
            openOrdersAccount,
            configuration.serumProgramId,
          );
        }
      }
    }
  }

  async listen(): Promise<void> {
    if (this.market) {
      this.connection.onAccountChange(
        this.market!.bidsAddress,
        (accountInfo: AccountInfo<Buffer>, context: Context) => {
          this.bids = Orderbook.decode(this.market!, accountInfo!.data);
        },
        'processed' as Commitment,
      );
      this.connection.onAccountChange(
        this.market!.asksAddress,
        (accountInfo: AccountInfo<Buffer>, context: Context) => {
          this.asks = Orderbook.decode(this.market!, accountInfo!.data);
        },
        'processed' as Commitment,
      );
      this.connection.onAccountChange(
        (this.market as any)._decoded.eventQueue,
        (accountInfo: AccountInfo<Buffer>, context: Context) => {
          this.eventsBuffer = accountInfo!.data;
          this.hasEvents = true;
          this.events = decodeEventsSince(accountInfo!.data, this.seqNum);
          if (this.configuration.verbose && this.openOrders) {
            for (const event of this.events) {
              if (
                event.seqNum &&
                event.seqNum > this.seqNum &&
                event.openOrders.equals(this.openOrders.address)
              ) {
                if (event.eventFlags.fill) {
                  console.log(`  FILL`);
                } else if (event.eventFlags.out) {
                  console.log(`  OUT`);
                } else {
                  continue;
                }
                console.log(
                  `    bid                    = ${event.eventFlags.bid}`,
                );
                console.log(
                  `    maker                  = ${event.eventFlags.maker}`,
                );
                console.log(`    feeTier                = ${event.feeTier}`);
                console.log(
                  `    nativeQuantityPaid     = ${event.nativeFeeOrRebate}`,
                );
                console.log(
                  `    nativeQuantityPaid     = ${event.nativeQuantityPaid}`,
                );
                console.log(
                  `    nativeQuantityReleased = ${event.nativeQuantityReleased}`,
                );
                console.log(`    openOrders             = ${event.openOrders}`);
                console.log(
                  `    openOrdersSlot         = ${event.openOrdersSlot}`,
                );
                console.log(`    orderId                = ${event.orderId}`);
                console.log(`    seqNum                 = ${event.seqNum}`);
                console.log('');
              }
            }
          }
          for (const event of this.events) {
            if (event.seqNum) {
              this.seqNum = event.seqNum;
            }
          }
        },
        'processed' as Commitment,
      );

      if (this.openOrders) {
        await this.listenOpenOrders();
      }
    }
  }

  async listenOpenOrders(): Promise<void> {
    assert(this.openOrders);
    this.connection.onAccountChange(
      this.openOrders.address,
      (accountInfo: AccountInfo<Buffer>, context: Context) => {
        assert(this.openOrders);
        this.openOrders = OpenOrders.fromAccountInfo(
          this.openOrders.address,
          accountInfo,
          this.configuration.serumProgramId,
        );
      },
      'confirmed' as Commitment,
    );
    if (this.configuration.verbose) {
      console.log(
        `Listening to OpenOrders for ${this.marketConfiguration.symbol}`,
      );
    }
  }

  static async load(
    connection: Connection,
    owner: PublicKey,
    programId: PublicKey,
    markets: Market[],
  ): Promise<void> {
    const publicKeys: PublicKey[] = [];
    for (const market of markets) {
      if (market instanceof SerumMarket) {
        assert(market.marketConfiguration.market);
        publicKeys.push(new PublicKey(market.marketConfiguration.market));
        assert(market.marketConfiguration.bids);
        publicKeys.push(new PublicKey(market.marketConfiguration.bids));
        assert(market.marketConfiguration.asks);
        publicKeys.push(new PublicKey(market.marketConfiguration.asks));
        assert(market.marketConfiguration.eventQueue);
        publicKeys.push(new PublicKey(market.marketConfiguration.eventQueue));
      }
    }
    const accounts = await connection.getMultipleAccountsInfo(publicKeys);
    let j = 0;
    for (let i = 0; i < accounts.length; ) {
      const market = markets[j];
      j++;
      if (market instanceof SerumMarket) {
        if (accounts[i]) {
          const decoded = MARKET_STATE_LAYOUT_V2.decode(accounts[i]!.data);
          assert(market.marketConfiguration.baseDecimals);
          assert(market.marketConfiguration.quoteDecimals);
          market.market = new SpotMarket(
            decoded,
            market.marketConfiguration.baseDecimals,
            market.marketConfiguration.quoteDecimals,
            {},
            programId,
          );
        }
        i++;
        if (market.market && accounts[i]) {
          market.bids = Orderbook.decode(market.market, accounts[i]!.data);
        }
        i++;
        if (market.market && accounts[i]) {
          market.asks = Orderbook.decode(market.market, accounts[i]!.data);
        }
        i++;
        if (market.market && accounts[i]) {
          market.eventsBuffer = accounts[i]!.data;
          market.hasEvents = true;
          market.events = decodeEventsSince(accounts[i]!.data, market.seqNum);
          for (const event of market.events) {
            if (event.seqNum) {
              market.seqNum = event.seqNum;
            }
          }
        }
        i++;
      }
    }

    const openOrdersAccounts = await findOpenOrdersAccountsForOwner(
      connection,
      owner,
      programId,
    );

    for (const openOrdersAccount of openOrdersAccounts) {
      const openOrders = OpenOrders.fromAccountInfo(
        openOrdersAccount.publicKey,
        openOrdersAccount.accountInfo,
        programId,
      );

      const market = markets.find(markets => {
        return (
          markets.marketConfiguration.market.toBase58() ==
          openOrders.market.toBase58()
        );
      });

      if (market && market instanceof SerumMarket) {
        market.openOrders = openOrders;
      }
    }
  }

  parseFillEvents(): Event[] {
    const fills: Event[] = [];
    for (const event of this.events) {
      if (event.eventFlags.fill) {
        fills.push(this.parseFillEvent(event));
      }
    }
    return fills;
  }

  parseFillEvent(event) {
    let size, price, side, priceBeforeFees;
    if (event.eventFlags.bid) {
      side = 'buy';
      priceBeforeFees = event.eventFlags.maker
        ? event.nativeQuantityPaid.add(event.nativeFeeOrRebate)
        : event.nativeQuantityPaid.sub(event.nativeFeeOrRebate);
      price = divideBnToNumber(
        priceBeforeFees.mul((this.market! as any)._baseSplTokenMultiplier),
        (this.market! as any)._quoteSplTokenMultiplier.mul(
          event.nativeQuantityReleased,
        ),
      );
      size = divideBnToNumber(
        event.nativeQuantityReleased,
        (this.market! as any)._baseSplTokenMultiplier,
      );
    } else {
      side = 'sell';
      priceBeforeFees = event.eventFlags.maker
        ? event.nativeQuantityReleased.sub(event.nativeFeeOrRebate)
        : event.nativeQuantityReleased.add(event.nativeFeeOrRebate);
      price = divideBnToNumber(
        priceBeforeFees.mul((this.market! as any)._baseSplTokenMultiplier),
        (this.market! as any)._quoteSplTokenMultiplier.mul(
          event.nativeQuantityPaid,
        ),
      );
      size = divideBnToNumber(
        event.nativeQuantityPaid,
        (this.market! as any)._baseSplTokenMultiplier,
      );
    }
    return {
      ...event,
      side,
      price,
      feeCost:
        this.market!.quoteSplSizeToNumber(event.nativeFeeOrRebate) *
        (event.eventFlags.maker ? -1 : 1),
      size,
    };
  }

  static async settleFunds(
    connection: Connection,
    owner: Account,
    markets: Market[],
  ) {
    const transaction = new Transaction();
    for (const market of markets) {
      if (market instanceof SerumMarket) {
        if (market.openOrders) {
          if (
            market.openOrders.baseTokenFree.gt(new BN(0)) ||
            market.openOrders.quoteTokenFree.gt(new BN(0))
          ) {
            if (market.configuration.verbose) {
              console.log(`settleFunds ${market.openOrders!.address}`);
            }
            const vaultSigner = await PublicKey.createProgramAddress(
              [
                market.market!.address.toBuffer(),
                market.market!.decoded.vaultSignerNonce.toArrayLike(
                  Buffer,
                  'le',
                  8,
                ),
              ],
              market.market!.programId,
            );
            transaction.add(
              DexInstructions.settleFunds({
                market: market.market!.address,
                openOrders: market.openOrders!.address,
                owner: owner.publicKey,
                baseVault: market.market!.decoded.baseVault,
                quoteVault: market.market!.decoded.quoteVault,
                baseWallet: market.basePosition.tokenAccount,
                quoteWallet: market.quotePosition.tokenAccount,
                vaultSigner,
                programId: market.market!.programId,
                referrerQuoteWallet: market.quotePosition.tokenAccount,
              }),
            );
          }
        }
      }
    }
    if (transaction.instructions.length > 0) {
      const result = await connection.sendAndConfirmTransaction(transaction, [
        owner,
      ]);
      if (result.err) {
        const errorCode: number =
          result.err.valueOf()['InstructionError'][1]['Custom'];
        console.log(`SERUM ERROR: ${getSerumError(errorCode)}`);
      }
    }
  }

  toPriceLevels(orderBook: Orderbook, depth: number = 8): [number, number][] {
    const descending = orderBook.isBids;
    const levels: [BN, BN][] = [];
    for (const { key, quantity } of orderBook.slab.items(descending)) {
      const price = key.ushrn(64);
      if (levels.length > 0 && levels[levels.length - 1][0].eq(price)) {
        levels[levels.length - 1][1].iadd(quantity);
      } else {
        levels.push([price, quantity]);
      }
    }
    return levels
      .slice(0, depth)
      .map(([priceLots, sizeLots]) => [
        this.market!.priceLotsToNumber(priceLots),
        this.market!.baseSizeLotsToNumber(sizeLots),
      ]);
  }
}

function divideBnToNumber(numerator: BN, denominator: BN): number {
  const quotient = numerator.div(denominator).toNumber();
  const rem = numerator.umod(denominator);
  const gcd = rem.gcd(denominator);
  return quotient + rem.div(gcd).toNumber() / denominator.div(gcd).toNumber();
}

async function findOpenOrdersAccountsForOwner(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey,
): Promise<{ publicKey: PublicKey; accountInfo: AccountInfo<Buffer> }[]> {
  const filters = [
    {
      memcmp: {
        offset: OpenOrders.getLayout(programId).offsetOf('owner'),
        bytes: owner.toBase58(),
      },
    },
    {
      dataSize: OpenOrders.getLayout(programId).span,
    },
  ];
  // @ts-ignore
  const resp = await connection._rpcRequest('getProgramAccounts', [
    programId.toBase58(),
    {
      commitment: connection.commitment,
      filters,
      encoding: 'base64',
    },
  ]);
  if (resp.error) {
    throw new Error(resp.error.message);
  }
  return resp.result.map(
    ({ pubkey, account: { data, executable, owner, lamports } }) => ({
      publicKey: new PublicKey(pubkey),
      accountInfo: {
        data: Buffer.from(data[0], 'base64'),
        executable,
        owner: new PublicKey(owner),
        lamports,
      },
    }),
  );
}

export function getSerumError(errorCode: number): string {
  switch (errorCode) {
    case 0: {
      return 'InvalidMarketFlags';
    }
    case 1: {
      return 'InvalidAskFlags';
    }
    case 2: {
      return 'InvalidBidFlags';
    }
    case 3: {
      return 'InvalidQueueLength';
    }
    case 4: {
      return 'OwnerAccountNotProvided';
    }

    case 5: {
      return 'ConsumeEventsQueueFailure';
    }
    case 6: {
      return 'WrongCoinVault';
    }
    case 7: {
      return 'WrongPcVault';
    }
    case 8: {
      return 'WrongCoinMint';
    }
    case 9: {
      return 'WrongPcMint';
    }

    case 10: {
      return 'CoinVaultProgramId';
    }
    case 11: {
      return 'PcVaultProgramId';
    }
    case 12: {
      return 'CoinMintProgramId';
    }
    case 13: {
      return 'PcMintProgramId';
    }
    case 14: {
      return 'WrongCoinMintSize';
    }

    case 15: {
      return 'WrongPcMintSize';
    }
    case 16: {
      return 'WrongCoinVaultSize';
    }
    case 17: {
      return 'WrongPcVaultSize';
    }
    case 18: {
      return 'UninitializedVault';
    }
    case 19: {
      return 'UninitializedMint';
    }

    case 20: {
      return 'CoinMintUninitialized';
    }
    case 21: {
      return 'PcMintUninitialized';
    }
    case 22: {
      return 'WrongMint';
    }
    case 23: {
      return 'WrongVaultOwner';
    }
    case 24: {
      return 'VaultHasDelegate';
    }

    case 25: {
      return 'AlreadyInitialized';
    }
    case 26: {
      return 'WrongAccountDataAlignment';
    }
    case 27: {
      return 'WrongAccountDataPaddingLength';
    }
    case 28: {
      return 'WrongAccountHeadPadding';
    }
    case 29: {
      return 'WrongAccountTailPadding';
    }

    case 30: {
      return 'RequestQueueEmpty';
    }
    case 31: {
      return 'EventQueueTooSmall';
    }
    case 32: {
      return 'SlabTooSmall';
    }
    case 33: {
      return 'BadVaultSignerNonce';
    }
    case 34: {
      return 'InsufficientFunds';
    }

    case 35: {
      return 'SplAccountProgramId';
    }
    case 36: {
      return 'SplAccountLen';
    }
    case 37: {
      return 'WrongFeeDiscountAccountOwner';
    }
    case 38: {
      return 'WrongFeeDiscountMint';
    }
    case 39: {
      return 'CoinPayerProgramId';
    }

    case 40: {
      return 'PcPayerProgramId';
    }
    case 41: {
      return 'ClientIdNotFound';
    }
    case 42: {
      return 'TooManyOpenOrders';
    }
    case 43: {
      return 'FakeErrorSoWeDontChangeNumbers';
    }
    case 44: {
      return 'BorrowError';
    }

    case 45: {
      return 'WrongOrdersAccount';
    }
    case 46: {
      return 'WrongBidsAccount';
    }
    case 47: {
      return 'WrongAsksAccount';
    }
    case 48: {
      return 'WrongRequestQueueAccount';
    }
    case 49: {
      return 'WrongEventQueueAccount';
    }

    case 50: {
      return 'RequestQueueFull';
    }
    case 51: {
      return 'EventQueueFull';
    }
    case 52: {
      return 'MarketIsDisabled';
    }
    case 53: {
      return 'WrongSigner';
    }
    case 54: {
      return 'TransferFailed';
    }

    case 55: {
      return 'ClientOrderIdIsZero';
    }
    case 56: {
      return 'WrongRentSysvarAccount';
    }
    case 57: {
      return 'RentNotProvided';
    }
    case 58: {
      return 'OrdersNotRentExempt';
    }
    case 59: {
      return 'OrderNotFound';
    }

    case 60: {
      return 'OrderNotYours';
    }
    case 61: {
      return 'WouldSelfTrade';
    }
    case 62: {
      return 'InvalidOpenOrdersAuthority';
    }
    case 63: {
      return 'OrderMaxTimestampExceeded';
    }

    default: {
      return 'Unknown';
    }
  }
}
