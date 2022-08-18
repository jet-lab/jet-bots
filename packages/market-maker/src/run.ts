#!/usr/bin/env ts-node

import { createBot } from './bots';
import { Crank } from './bots/crank';
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

      try {
        if (context.marginAccount) {
          await context.marginAccount.cancelOrders();
        }
      } catch (err) {
        console.log(JSON.stringify(err));
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
  const verbose = true;

  const marginAccountContext = new Context({ verbose });

  const marketDataContext = new Context({
    cluster: 'mainnet-beta',
    verbose,
    symbols: marginAccountContext.symbols,
  });

  await marketDataContext.load();

  await marginAccountContext.load({
    botFactory: createBot,
    marketDataContext,
  });
  await marginAccountContext.marginAccount!.createTokenAccounts();
  await marginAccountContext.marginAccount!.createOpenOrders();

  const crank =
    marginAccountContext.configuration.cluster == 'devnet' ||
    marginAccountContext.configuration.cluster == 'localnet'
      ? new Crank(marginAccountContext, marketDataContext)
      : undefined;

  await marketDataContext.listen();
  await marginAccountContext.listen();

  const controller = new Controller(marginAccountContext);

  console.log(`MARKET MAKER RUNNING - Press Ctrl+C to exit.`);
  console.log(``);

  while (controller.isRunning) {
    try {
      if (marginAccountContext.bot) {
        marginAccountContext.bot.process();
      }

      if (crank) {
        crank.process();
      }
    } catch (e) {
      console.log(e);
    }

    await sleep(controller.interval);
  }

  console.log(`MARKET MAKER STOPPING`);
}

run();
