#!/usr/bin/env ts-node

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class Controller {
  isRunning = true;
  interval = 4000;

  constructor() {
    process.on('SIGINT', async () => {
      console.log('Caught keyboard interrupt.');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

      //TODO clean up.

      console.log(`PERP FUNDING ARB EXITED`);

      process.exit();
    });

    process.on('unhandledRejection', (err, promise) => {
      console.error(
        'Unhandled rejection (promise: ',
        promise,
        ', reason: ',
        err,
        ').',
      );
    });
  }
}

async function run() {
  const controller = new Controller();

  console.log(`PERP FUNDING ARB RUNNING - Press Ctrl+C to exit.`);
  console.log(``);

  while (controller.isRunning) {
    try {
      //TODO implement
    } catch (e) {
      console.log(e);
    }

    await sleep(controller.interval);
  }

  console.log(`PERP FUNDING ARB STOPPING`);
}

run();
