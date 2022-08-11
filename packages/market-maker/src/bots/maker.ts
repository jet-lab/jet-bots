import { PublicKey } from '@solana/web3.js';

import { Bot, Context, SerumMarket } from '../';

const PARAMS = {
  maxPosition: 1_000,
  minPosition: 1_000,
  orderSize: 100,
  repriceBPS: 5,
  spreadBPS: 20,
};

interface Instrument {
  baseOracleSymbol: string;
  marketSymbol: string;
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
          new PublicKey(market.marketConfig.baseMint),
          PARAMS.minPosition,
          PARAMS.maxPosition,
        );
      }

      this.instruments.push({
        baseOracleSymbol: market.marketConfig.baseSymbol + '/USD',
        marketSymbol: market.marketConfig.symbol,
        quoteOracleSymbol: market.marketConfig.quoteSymbol + '/USD',
      });
    }
  }

  process(): void {
    const orders: any[] = [];
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
          side: 'buy',
          price: bidPrice,
          size: PARAMS.orderSize,
          orderType: 'limit',
          selfTradeBehavior: 'cancelProvide',
        });
        orders.push({
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
