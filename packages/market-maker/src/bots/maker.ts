import { Bot, Context, PythOracle, SerumMarket } from '../';

const PARAMS = {
  spreadBPS: 20,
};

export class Maker extends Bot {
  buyOrders: Record<string, any> = {};
  sellOrders: Record<string, any> = {};

  constructor(tradingContext: Context, marketDataContext: Context) {
    super(tradingContext, marketDataContext);
  }

  process(): void {
    console.log('');
    console.log('');
    for (const oracle of Object.values<PythOracle>(
      this.marketDataContext.oracles,
    )) {
      if (oracle.price) {
        console.log(
          `${oracle.oracleConfig.symbol} price = ${oracle.price.price}`,
        );
      }
    }
    console.log('');
    for (const market of Object.values<SerumMarket>(
      this.tradingContext.markets,
    )) {
      if (market.market) {
        console.log(`${market.marketConfig.symbol}`);
        if (market.bids) {
          console.log(
            `bids = ${JSON.stringify(market.toPriceLevels(market.bids))}`,
          );
        }
        if (market.asks) {
          console.log(
            `asks = ${JSON.stringify(market.toPriceLevels(market.asks))}`,
          );
        }
      }
    }
    console.log('');
  }
}
