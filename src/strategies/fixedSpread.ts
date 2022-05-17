import { Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";

import { Configuration } from '../configuration';
import { Oracle } from '../oracle';
import { PositionManager } from '../positionManager';
import { Strategy } from './strategy';

export class FixedSpread extends Strategy {

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

    const fairValue: number = this.oracle.price?.price!;
    const halfSpread: number = fairValue * this.configuration.params.spreadBPS * 0.0001;

    const askPrice: number = fairValue + halfSpread;
    const bidPrice: number = fairValue - halfSpread;

    //TODO implement.

    //const baseOpenOrdersBalance = market.baseOpenOrdersBalance;
    //const quoteOpenOrdersBalance = market.quoteOpenOrdersBalance;
    //const accountValue = ((baseTokenBalance + baseOpenOrdersBalance) * fairValue) + (quoteTokenBalance + quoteOpenOrdersBalance);

    //const quoteSize = accountValue * this.configuration.params.sizePercent;

    return [newOrders, staleOrders];
  }

}
