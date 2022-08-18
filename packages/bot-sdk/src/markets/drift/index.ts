import { MarketConfiguration } from '../../configuration';
import { Market } from '../market';

export class DriftMarket extends Market {
  constructor(marketConfig: MarketConfiguration) {
    super(marketConfig);
  }
}
