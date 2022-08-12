#!/usr/bin/env ts-node

import { createBot } from './bots';
import { Context } from './context';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class Controller {
  isRunning = true;
  interval = 4000;

  constructor(context: Context) {
    process.on('SIGINT', async () => {
      console.log('Caught keyboard interrupt.');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

      if (context.marginAccount) {
        await context.marginAccount.cancelOrders();
      }

      console.log(`MARKET MAKER EXITED`);

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
  const context = new Context();
  const mainnetContext = new Context({
    cluster: 'mainnet-beta',
    symbols: context.symbols,
  });

  await mainnetContext.load();
  await context.load({
    botFactory: createBot,
    marketDataContext: mainnetContext,
  });

  await mainnetContext.listen();
  await context.listen();

  const controller = new Controller(context);

  console.log(`MARKET MAKER RUNNING - Press Ctrl+C to exit.`);
  console.log(``);

  while (controller.isRunning) {
    try {
      if (context.bot) {
        context.bot.process();
      }
    } catch (e) {
      console.log(e);
    }

    await sleep(controller.interval);
  }

  console.log(`MARKET MAKER STOPPING`);
}

run();
