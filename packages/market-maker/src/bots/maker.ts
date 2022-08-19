//TODO load this from a package.
import {
  MarginAccount,
  Order,
  PythOracle,
  Market,
} from '../../../bot-sdk/src/';

import { Bot } from './bot';

const PARAMS = {
  maxPosition: 1_000,
  minPosition: -1_000,
  orderSize: 100,
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

  constructor(
    marginAccount: MarginAccount,
    oracles: Record<string, PythOracle>,
  ) {
    super(marginAccount);
    this.oracles = oracles;

    for (const market of Object.values<Market>(this.marginAccount.markets)) {
      this.marginAccount.setLimits(
        market.marketConfiguration.baseSymbol,
        PARAMS.minPosition,
        PARAMS.maxPosition,
      );

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
          market: 'serum',
          symbol: instrument.market.marketConfiguration.symbol,
          side: 'buy',
          price: bidPrice,
          size: PARAMS.orderSize,
          orderType: 'limit',
          selfTradeBehavior: 'cancelProvide',
        });
        orders.push({
          market: 'serum',
          symbol: instrument.market.marketConfiguration.symbol,
          side: 'sell',
          price: askPrice,
          size: PARAMS.orderSize,
          orderType: 'limit',
          selfTradeBehavior: 'cancelProvide',
        });
        this.sendOrders(orders);
      }
    }
  }
}
