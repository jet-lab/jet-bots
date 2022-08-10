#!/usr/bin/env ts-node

import { BN } from '@project-serum/anchor';
import { Market, OpenOrders, Orderbook } from '@project-serum/serum';
import { Order, OrderParams } from '@project-serum/serum/lib/market';
import {
  AccountInfo,
  Commitment,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import assert from 'assert';

import { createBot } from './bots';
import { Context } from './context';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class Controller {
  isRunning = true;
  interval = 4000;

  constructor(context: Context) {
    process.on('SIGINT', async () => {
      console.log('Caught keyboard interrupt.');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

      /*
      if (context.bot) {
        await context.bot.cancelOpenOrders();
        await context.bot.closeOpenOrdersAccounts();
      }
      */

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
  const mainnetContext = new Context({ cluster: 'mainnet-beta' });

  const context = new Context({
    botFactory: createBot,
    marketDataContext: mainnetContext,
  });

  await mainnetContext.load();
  await context.load();

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
