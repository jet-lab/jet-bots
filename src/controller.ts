import assert from 'assert';

import { Strategy } from './strategies/strategy';
import { sleep } from './utils';

export class Controller {

  isRunning = true;
  interval = 4000;

  constructor(
    strategies: Strategy[],
  ) {
    process.on('SIGINT', async () => {

      console.log('Caught keyboard interrupt.');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

      for (const strategy of strategies) {
        await strategy.cancelOpenOrders();
        await strategy.closeOpenOrdersAccounts();
      }

      console.log(`MARKET MAKER EXITED`);

      process.exit();
    });

    process.on('unhandledRejection', (err, promise) => {
      console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
    });
  }

};
