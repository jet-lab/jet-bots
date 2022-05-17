import { Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";

import { Configuration } from '../configuration';
import { Oracle } from '../oracle';
import { PositionManager } from '../positionManager';
import { Strategy } from './strategy';

export class PennyJumping extends Strategy {

  constructor(
    configuration: Configuration,
    oracle: Oracle,
    positionManager: PositionManager,
  ) {
    super(
      configuration,
      oracle,
      positionManager,
    );
  }

  async update(asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]> {
    let newOrders: OrderParams[] = [];
    let staleOrders: Order[] = [];

    //TODO

    return [newOrders, staleOrders];
  }

}
