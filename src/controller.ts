import { sleep } from './utils';

export class Controller {

  isRunning = true;
  interval = 1000;

  constructor(
  ) {
    process.on('SIGINT', async () => {

      console.log('Caught keyboard interrupt.');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

    });

    process.on('unhandledRejection', (err, promise) => {
      console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
    });
  }

};
