import { BN } from '@project-serum/anchor';
import { Market, Orderbook } from '@project-serum/serum';
import { MARKET_STATE_LAYOUT_V2 } from '@project-serum/serum/lib/market';
import { decodeEventQueue, Event } from '@project-serum/serum/lib/queue';
import {
  AccountInfo,
  Commitment,
  Connection,
  Context,
  PublicKey,
} from '@solana/web3.js';
import assert from 'assert';

import { MarketConfiguration } from '../../configuration';
import { Market as MarketBase } from '../market';

export class SerumMarket extends MarketBase {
  connection: Connection;
  market?: Market;
  asks?: Orderbook;
  bids?: Orderbook;
  events: Event[] = [];
  eventsAccountInfo?: Buffer;
  seqNum: number = 0;
  hasEvents: boolean = false;

  constructor(
    marketConfiguration: MarketConfiguration,
    connection: Connection,
  ) {
    super(marketConfiguration);
    this.connection = connection;
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
          this.eventsAccountInfo = accountInfo!.data;
          this.events = decodeEventQueue(accountInfo!.data, this.seqNum);
          for (const event of this.events) {
            this.hasEvents = true;
            if (event.seqNum) {
              this.seqNum = event.seqNum;
            }
          }
        },
        'processed' as Commitment,
      );
    }
  }

  static async load(
    connection: Connection,
    programId: PublicKey,
    markets: SerumMarket[],
  ): Promise<void> {
    const publicKeys: PublicKey[] = [];
    for (const market of markets) {
      assert(market.marketConfiguration.market);
      publicKeys.push(new PublicKey(market.marketConfiguration.market));
      assert(market.marketConfiguration.bids);
      publicKeys.push(new PublicKey(market.marketConfiguration.bids));
      assert(market.marketConfiguration.asks);
      publicKeys.push(new PublicKey(market.marketConfiguration.asks));
      assert(market.marketConfiguration.eventQueue);
      publicKeys.push(new PublicKey(market.marketConfiguration.eventQueue));
    }
    const accounts = await connection.getMultipleAccountsInfo(publicKeys);
    let j = 0;
    for (let i = 0; i < accounts.length; ) {
      const market = markets[j];
      j++;
      if (accounts[i]) {
        const decoded = MARKET_STATE_LAYOUT_V2.decode(accounts[i]!.data);
        assert(market.marketConfiguration.baseDecimals);
        assert(market.marketConfiguration.quoteDecimals);
        market.market = new Market(
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
        market.events = decodeEventQueue(accounts[i]!.data);
        for (const event of market.events) {
          if (event.seqNum) {
            market.seqNum = event.seqNum;
          }
        }
      }
      i++;
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
