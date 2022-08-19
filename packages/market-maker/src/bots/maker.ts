//TODO load this from a package.
import { Order, Protocol, PythOracle, Market } from '../../../bot-sdk/src/';

import { Bot } from './bot';

const PARAMS = {
  maxOrderAmount: 100,
  maxPositionAmount: 1_000,
  minOrderInterval: 5,
  minPositionAmount: -1_000,
  repriceBPS: 5, //TODO
  spreadBPS: 20,
};

interface Instrument {
  market: Market;
  baseOracle: PythOracle;
  quoteOracle: PythOracle;
}

export class Maker extends Bot {
  oracles: Record<string, PythOracle>;

  instruments: Instrument[] = [];

  constructor(protocol: Protocol, oracles: Record<string, PythOracle>) {
    super(protocol);
    this.oracles = oracles;

    for (const market of Object.values<Market>(this.protocol.markets)) {
      this.protocol.setLimits({
        symbol: market.marketConfiguration.baseSymbol,
        maxOrderAmount: PARAMS.maxOrderAmount,
        maxPositionAmount: PARAMS.maxPositionAmount,
        minOrderInterval: PARAMS.minOrderInterval,
        minPositionAmount: PARAMS.minPositionAmount,
      });
      this.instruments.push({
        market,
        baseOracle: oracles[market.marketConfiguration.baseSymbol + '/USD'],
        quoteOracle: oracles[market.marketConfiguration.quoteSymbol + '/USD'],
      });
    }
  }

  async process(): Promise<void> {
    for (const instrument of this.instruments) {
      const orders: Order[] = [];
      const basePrice = instrument.baseOracle.price;
      const quotePrice = instrument.quoteOracle.price;
      if (basePrice && basePrice.price && quotePrice && quotePrice.price) {
        const fairPrice = basePrice.price / quotePrice.price;
        const askPrice = fairPrice + fairPrice * (PARAMS.spreadBPS / 10_000);
        const bidPrice = fairPrice - fairPrice * (PARAMS.spreadBPS / 10_000);

        //TODO only update orders if the price has moved significantly using repriceBPS.

        orders.push({
          dex: 'serum',
          symbol: instrument.market.marketConfiguration.symbol,
          side: 'buy',
          price: bidPrice,
          size: PARAMS.maxOrderAmount / bidPrice,
          orderType: 'limit',
          selfTradeBehavior: 'cancelProvide',
        });
        orders.push({
          dex: 'serum',
          symbol: instrument.market.marketConfiguration.symbol,
          side: 'sell',
          price: askPrice,
          size: PARAMS.maxOrderAmount / askPrice,
          orderType: 'limit',
          selfTradeBehavior: 'cancelProvide',
        });
        this.sendOrders(orders);
      }
    }
  }
}
