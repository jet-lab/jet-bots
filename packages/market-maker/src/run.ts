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
  const context = new Context({ botFactory: createBot });
  await context.load();

  const mainnetContext = new Context({ cluster: 'mainnet-beta' });
  await context.loadOracle(mainnetContext.connection);

  const controller = new Controller(context);
  console.log(`MAKING MARKETS`);

  while (controller.isRunning) {
    for (const marketConfig of Object.values<any>(context.config.markets)) {
      try {
        /*
        //const [ asks, bids, price ]: [ Orderbook, Orderbook, void] = await Promise.all([
        const [asks, bids]: [Orderbook, Orderbook] = await Promise.all([
          await markets[symbol].loadAsks(connection),
          await markets[symbol].loadBids(connection),
        ]);
        */
        //TODO
        /*
        if (configuration.verbose && asks && bids) {
          console.log(`asks = ${JSON.stringify(asks.getL2(10))}`);
          console.log(`bids = ${JSON.stringify(bids.getL2(10))}`);
        }
        */
        /*
          const [openOrdersAccountInfo]: [AccountInfo<Buffer> | null, void] =
            await Promise.all([
              await connection.getAccountInfo(
                context.bots[i].positions[symbol].openOrdersAccount,
              ),
              await context.bots[i].positions[symbol].fetchBalances(),
            ]);
          */
        //TODO
        /*
          if (configuration.verbose) {
            console.log(
              `Account balance = ${
                context.bots[i].positions[symbol].balance /
                LAMPORTS_PER_SOL
              } SOL`,
            );
            console.log(
              `Base token balance = ${JSON.stringify(
                context.bots[i].positions[symbol].baseTokenBalance,
              )}`,
            );
            console.log(
              `Quote token balance = ${JSON.stringify(
                context.bots[i].positions[symbol].quoteTokenBalance,
              )}`,
            );
          }
          */
        /*
          if (openOrdersAccountInfo) {
            const openOrders = OpenOrders.fromAccountInfo(
              context.bots[i].positions[symbol].openOrdersAccount,
              openOrdersAccountInfo,
              markets[symbol].programId,
            );

            //const [ newOrders, cancelOrders ]: [OrderParams[], Order[]] = await context.bots[i].update(symbol, asks, bids, openOrders.orders.filter((orderId) => { return !orderId.eq(new BN(0)); }));
            const [newOrders, cancelOrders]: [OrderParams[], Order[]] = await context.bots[i].update(symbol, asks, bids);
            */
        /*
            await context.bots[i].updateOrders(
              markets[symbol],
              newOrders,
              cancelOrders,
            );
            */
        /*
            if (
              openOrders.baseTokenFree.gt(new BN(0)) ||
              openOrders.quoteTokenFree.gt(new BN(0))
            ) {
              await context.bots[i].positions[symbol].settleFunds();
            }
            */
        /*
          }
          */
      } catch (e) {
        console.log(e);
      }
    }

    await sleep(controller.interval);
  }

  console.log(`MARKET MAKER STOPPING`);
}

run();
