import { PublicKey } from '@solana/web3.js';

//TODO load this from a package.
import { Order } from '../../../bot-sdk/src/';

import { Bot, Context, SerumMarket } from '../';

const PARAMS = {
  maxPosition: 1_000,
  minPosition: -1_000,
  orderSize: 100,
  repriceBPS: 5,
  spreadBPS: 20,
};

interface Instrument {
  market: SerumMarket;
  baseOracleSymbol: string;
  quoteOracleSymbol: string;
}

export class Maker extends Bot {
  instruments: Instrument[] = [];

  constructor(tradingContext: Context, marketDataContext: Context) {
    super(tradingContext, marketDataContext);

    for (const market of Object.values<SerumMarket>(
      this.tradingContext.markets,
    )) {
      if (this.tradingContext.marginAccount) {
        this.tradingContext.marginAccount.setLimits(
          market.marketConfig.baseSymbol,
          PARAMS.minPosition,
          PARAMS.maxPosition,
        );
      }

      this.instruments.push({
        market,
        baseOracleSymbol: market.marketConfig.baseSymbol + '/USD',
        quoteOracleSymbol: market.marketConfig.quoteSymbol + '/USD',
      });
    }
  }

  process(): void {
    const orders: Order[] = [];
    for (const instrument of this.instruments) {
      const basePrice =
        this.marketDataContext.oracles[instrument.baseOracleSymbol].price;
      const quotePrice =
        this.marketDataContext.oracles[instrument.quoteOracleSymbol].price;
      if (basePrice && basePrice.price && quotePrice && quotePrice.price) {
        const fairPrice = basePrice.price / quotePrice.price;
        const askPrice = fairPrice + fairPrice * (PARAMS.spreadBPS / 10_000);
        const bidPrice = fairPrice - fairPrice * (PARAMS.spreadBPS / 10_000);

        //TODO only update orders if the price has moved significantly using repriceBPS.

        orders.push({
          symbol: instrument.market.marketConfig.symbol,
          side: 'buy',
          price: bidPrice,
          size: PARAMS.orderSize,
          orderType: 'limit',
          selfTradeBehavior: 'cancelProvide',
        });
        orders.push({
          symbol: instrument.market.marketConfig.symbol,
          side: 'sell',
          price: askPrice,
          size: PARAMS.orderSize,
          orderType: 'limit',
          selfTradeBehavior: 'cancelProvide',
        });
      }
      this.sendOrders(orders);
    }
  }
}
