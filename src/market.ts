import { BN } from "@project-serum/anchor";
import {
  Market as SerumMarket,
  Orderbook,
} from "@project-serum/serum";
import {
  ORDERBOOK_LAYOUT,
} from "@project-serum/serum/lib/market";
import { Commitment, Connection, PublicKey } from '@solana/web3.js';

import { Configuration } from './configuration';

export class Market {

  configuration: Configuration;
  connection: Connection;

  address: PublicKey;
  baseMint: PublicKey;
  baseDecimals: number;
  quoteMint: PublicKey;
  quoteDecimals: number;
  //eventQueue: PublicKey;
  bids: PublicKey;
  asks: PublicKey;
  baseLotSize: BN;
  quoteLotSize: BN;
  feeRateBps: number;

  serumProgramId: PublicKey;

  serumMarket: SerumMarket | undefined;

  constructor(
    configuration: Configuration,
    connection: Connection,
  ) {
    this.configuration = configuration;
    this.connection = connection;

    const market = configuration.config.markets.find((market) => { return market.symbol == configuration.symbol; })!;

    this.address = new PublicKey(market.market);
    this.baseMint = new PublicKey(market.baseMint);
    this.baseDecimals = market.baseDecimals;
    this.quoteMint = new PublicKey(market.quoteMint);
    this.quoteDecimals = market.quoteDecimals;
    //this.eventQueue = new PublicKey(market.eventQueue);
    this.bids = new PublicKey(market.bids);
    this.asks = new PublicKey(market.asks);
    this.baseLotSize = new BN(market.baseLotSize);
    this.quoteLotSize = new BN(market.quoteLotSize);
    this.feeRateBps = market.feeRateBps;

    this.serumProgramId = new PublicKey(configuration.config.serumProgramId);
  }

  static async load(
    configuration: Configuration,
    connection: Connection,
  ) {
    const market = new Market(configuration, connection);
    market.serumMarket = await SerumMarket.load(connection, new PublicKey(market.address), { skipPreflight: true, commitment: 'processed' as Commitment }, market.serumProgramId);
    return market;
  }

  async fetchAsks()
  {
    const accountInfo = await this.connection.getAccountInfo(this.asks);
    //console.log(`  asks = ${JSON.stringify(Orderbook.decode(this.serumMarket!, accountInfo!.data))}`);

    //const depth = 20; //TODO make this configurable.
    //book.ask = toPriceLevels((await this.connection.getAccountInfo(new PublicKey(market.asks), this.commitment))!.data, depth, book.baseLotSize, book.baseDecimals, book.quoteLotSize, book.quoteDecimals);
  }

  async fetchBids()
  {
    const accountInfo = await this.connection.getAccountInfo(this.bids);
    //console.log(`  bids = ${JSON.stringify(Orderbook.decode(this.serumMarket!, accountInfo!.data))}`);

    //const depth = 20; //TODO make this configurable.
    //book.bid = toPriceLevels((await this.connection.getAccountInfo(new PublicKey(market.bids), this.commitment))!.data, depth, book.baseLotSize, book.baseDecimals, book.quoteLotSize, book.quoteDecimals);
  }

};

function toPriceLevels(data, depth: number, baseLotSize: number, baseDecimals: number, quoteLotSize: number, quoteDecimals: number): [number, number, BN, BN][] {
  const { accountFlags, slab } = decodeOrderBook(data);
  const descending = accountFlags.bids;
  const levels: [BN, BN][] = []; // (price, size)
  for (const { key, quantity } of slab.items(descending)) {
    const price = key.ushrn(64);
    if (levels.length > 0 && levels[levels.length - 1][0].eq(price)) {
      levels[levels.length - 1][1].iadd(quantity);
    } else {
      levels.push([price, quantity]);
    }
  }
  return levels.slice(0, 7).map(([priceLots, sizeLots]) => [
    priceLotsToNumber(priceLots, new BN(baseLotSize), baseDecimals, new BN(quoteLotSize), quoteDecimals),
    baseSizeLotsToNumber(sizeLots, new BN(baseLotSize), baseDecimals),
    priceLots,
    sizeLots,
  ]);
}

function decodeOrderBook(buffer) {
  const { accountFlags, slab } = ORDERBOOK_LAYOUT.decode(buffer);
  return { accountFlags: accountFlags, slab: slab };
}

function priceLotsToNumber(price: BN, baseLotSize: BN, baseSplTokenDecimals: number, quoteLotSize: BN, quoteSplTokenDecimals: number) {
  return divideBnToNumber(price.mul(quoteLotSize).mul(baseSplTokenMultiplier(baseSplTokenDecimals)), baseLotSize.mul(quoteSplTokenMultiplier(quoteSplTokenDecimals)));
}

function baseSizeLotsToNumber(size: BN, baseLotSize: BN, baseSplTokenDecimals: number) {
  return divideBnToNumber(size.mul(baseLotSize), baseSplTokenMultiplier(baseSplTokenDecimals));
}

function divideBnToNumber(numerator: BN, denominator: BN): number {
  const quotient = numerator.div(denominator).toNumber();
  const rem = numerator.umod(denominator);
  const gcd = rem.gcd(denominator);
  return quotient + rem.div(gcd).toNumber() / denominator.div(gcd).toNumber();
}

function baseSplTokenMultiplier(baseSplTokenDecimals: number) {
  return new BN(10).pow(new BN(baseSplTokenDecimals));
}

function quoteSplTokenMultiplier(quoteSplTokenDecimals: number) {
  return new BN(10).pow(new BN(quoteSplTokenDecimals));
}
