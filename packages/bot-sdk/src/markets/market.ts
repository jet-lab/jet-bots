import { MarketConfiguration } from '../configuration';

export abstract class Market {
  marketConfiguration: MarketConfiguration;

  constructor(marketConfiguration: MarketConfiguration) {
    this.marketConfiguration = marketConfiguration;
  }
}
