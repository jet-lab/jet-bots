import { Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";

import { Configuration } from '../configuration';
import { Oracle } from '../oracle';
import { PositionManager } from '../positionManager';

export abstract class Strategy {

  configuration: Configuration;
  oracle: Oracle;
  positionManager: PositionManager;

  constructor(
    configuration: Configuration,
    oracle: Oracle,
    positionManager: PositionManager,
  ) {
    this.configuration = configuration;
    this.oracle = oracle;
    this.positionManager = positionManager;
  }

  abstract update(asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]>;

}
