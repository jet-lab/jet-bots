import { OrderManager } from './orderManager';
import { sleep } from './utils';

export class Controller {

  isRunning = true;
  interval = 1000;

  orderManager: OrderManager | undefined;

  constructor(
  ) {
    process.on('SIGINT', async () => {
      console.log('Caught keyboard interrupt. Canceling orders');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

      if (this.orderManager) {
        this.orderManager.cancelOpenOrders();
      }

      //process.exit();
    });

    process.on('unhandledRejection', (err, promise) => {
      console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
    });
  }

};
