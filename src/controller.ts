import assert from 'assert';

import { OrderManager } from './orderManager';
import { sleep } from './utils';

export class Controller {

  isRunning = true;
  interval = 1000;

  constructor(
    orderManager: OrderManager,
  ) {
    process.on('SIGINT', async () => {

      console.log('Caught keyboard interrupt.');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

      await orderManager.cancelOpenOrders();

      await orderManager.closeOpenOrdersAccounts();

      console.log(`MARKET MAKER EXITED`);

      process.exit();
    });

    process.on('unhandledRejection', (err, promise) => {
      console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
    });
  }

};
