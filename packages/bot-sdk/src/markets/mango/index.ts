import { MarketConfiguration } from '../../configuration';
import { Market } from '../market';

export class MangoMarket extends Market {
  constructor(marketConfig: MarketConfiguration) {
    super(marketConfig);
  }
}
