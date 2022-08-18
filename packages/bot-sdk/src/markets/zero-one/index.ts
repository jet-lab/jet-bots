import { MarketConfiguration } from '../../configuration';
import { Market } from '../market';

export class ZeroOneMarket extends Market {
  constructor(marketConfig: MarketConfiguration) {
    super(marketConfig);
  }
}
