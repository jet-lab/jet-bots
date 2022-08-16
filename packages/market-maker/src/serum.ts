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

//TODO reference this from a dependency.
import { MarketConfiguration } from '../../bot-sdk/src';

export class SerumMarket {
  marketConfig: MarketConfiguration;

  market?: Market;
  asks?: Orderbook;
  bids?: Orderbook;
  events: Event[] = [];
  seqNum: number = 0;

  constructor(marketConfig: MarketConfiguration) {
    this.marketConfig = marketConfig;
  }

  async listen(connection: Connection): Promise<void> {
    if (this.market) {
      connection.onAccountChange(
        this.market!.bidsAddress,
        (accountInfo: AccountInfo<Buffer>, context: Context) => {
          this.bids = Orderbook.decode(this.market!, accountInfo!.data);
        },
        'processed' as Commitment,
      );
      connection.onAccountChange(
        this.market!.asksAddress,
        (accountInfo: AccountInfo<Buffer>, context: Context) => {
          this.asks = Orderbook.decode(this.market!, accountInfo!.data);
        },
        'processed' as Commitment,
      );
      connection.onAccountChange(
        (this.market as any)._decoded.eventQueue,
        (accountInfo: AccountInfo<Buffer>, context: Context) => {
          this.events = decodeEventQueue(accountInfo!.data, this.seqNum);
          for (const event of this.events) {
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
      assert(market.marketConfig.market);
      publicKeys.push(new PublicKey(market.marketConfig.market));
      assert(market.marketConfig.bids);
      publicKeys.push(new PublicKey(market.marketConfig.bids));
      assert(market.marketConfig.asks);
      publicKeys.push(new PublicKey(market.marketConfig.asks));
      assert(market.marketConfig.eventQueue);
      publicKeys.push(new PublicKey(market.marketConfig.eventQueue));
    }
    const accounts = await connection.getMultipleAccountsInfo(publicKeys);
    let j = 0;
    for (let i = 0; i < accounts.length; ) {
      const market = markets[j];
      j++;
      if (accounts[i]) {
        const decoded = MARKET_STATE_LAYOUT_V2.decode(accounts[i]!.data);
        assert(market.marketConfig.baseDecimals);
        assert(market.marketConfig.quoteDecimals);
        market.market = new Market(
          decoded,
          market.marketConfig.baseDecimals,
          market.marketConfig.quoteDecimals,
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
