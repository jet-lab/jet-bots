import { BN } from '@project-serum/anchor';
import assert from 'assert';

import { Configuration, MarketConfiguration } from '../configuration';
import { Connection } from '../connection';
import { Position } from '../protocols/position';

export interface Order {
  dex: 'serum';
  symbol: string;
  clientId?: BN;
  orderType?: 'limit' | 'ioc' | 'postOnly';
  price: number;
  selfTradeBehavior?: 'decrementTake' | 'cancelProvide' | 'abortTransaction';
  side: 'buy' | 'sell';
  size: number;
}

export abstract class Market {
  configuration: Configuration;
  marketConfiguration: MarketConfiguration;
  basePosition: Position;
  quotePosition: Position;
  connection: Connection;

  constructor(
    configuration: Configuration,
    marketConfiguration: MarketConfiguration,
    positions: Record<string, Position>,
    connection: Connection,
  ) {
    this.configuration = configuration;
    this.marketConfiguration = marketConfiguration;
    assert(positions[this.marketConfiguration.baseSymbol]);
    this.basePosition = positions[this.marketConfiguration.baseSymbol];
    assert(positions[this.marketConfiguration.quoteSymbol]);
    this.quotePosition = positions[this.marketConfiguration.quoteSymbol];
    this.connection = connection;
  }

  abstract crank(): Promise<void>;

  abstract listen(): Promise<void>;
}
