import { Configuration, MarketConfiguration } from '../../configuration';
import { Connection } from '../../connection';
import { Position } from '../../protocols/position';
import { Market } from '../market';

export class MangoMarket extends Market {
  constructor(
    configuration: Configuration,
    marketConfiguration: MarketConfiguration,
    positions: Record<string, Position>,
    connection: Connection,
  ) {
    super(configuration, marketConfiguration, positions, connection);
  }

  async crank(): Promise<void> {
    throw new Error('Implement');
  }

  async listen(): Promise<void> {
    throw new Error('Implement');
  }
}
