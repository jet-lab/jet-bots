import assert from 'assert';

import { Bot, Context } from '../context';
import { Maker } from './maker';
import { Taker } from './taker';

export function createBot(
  type: string,
  tradingContext: Context,
  marketDataContext: Context,
): Bot {
  switch (type) {
    case 'maker':
      return new Maker(tradingContext, marketDataContext);
    case 'taker':
      assert(
        tradingContext.configuration.cluster == 'devnet' ||
          tradingContext.configuration.cluster == 'localnet',
      );
      return new Taker(tradingContext, marketDataContext);
    default: {
      console.log(`Unhandled bot type: ${type}`);
      process.exit();
    }
  }
}
