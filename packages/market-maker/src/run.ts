#!/usr/bin/env ts-node

import assert from 'assert';
import yargs from 'yargs/yargs';

//TODO load this from a package.
import {
  Configuration,
  Connection,
  MarginAccount,
  OracleConfiguration,
  PythOracle,
  SolanaMarginAccount,
} from '../../bot-sdk/src/';

import { Bot } from './bots/bot';
import { Crank } from './bots/crank';
import { Maker } from './bots/maker';
import { Taker } from './bots/taker';

function createBot(
  type: string,
  marginAccount: MarginAccount,
  oracles?: Record<string, PythOracle>,
): Bot {
  switch (type) {
    case 'maker':
      return new Maker(marginAccount, oracles!);
    case 'taker':
      assert(
        marginAccount.configuration.cluster == 'devnet' ||
          marginAccount.configuration.cluster == 'localnet',
      );
      return new Taker(marginAccount);
    default: {
      console.log(`Unhandled bot type: ${type}`);
      process.exit();
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class Controller {
  isRunning = true;
  interval = 4000;

  constructor(marginAccount: MarginAccount, crank?: Crank) {
    process.on('SIGINT', async () => {
      console.log('Caught keyboard interrupt.');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

      /*
      if (crank) {
        try {
          crank.process();
        } catch (err) {
          console.log(JSON.stringify(err));
        }
      }

      try {
        if (marginAccount) {
          await marginAccount.refreshOpenOrders();
        }
      } catch (err) {
        console.log(JSON.stringify(err));
      }
      */

      try {
        if (marginAccount) {
          await marginAccount.cancelOrders();
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
  const args = await yargs(process.argv.slice(2)).options({
    b: { alias: 'bot', required: true, type: 'string' },
    c: { alias: 'cluster', required: true, type: 'string' },
    k: { alias: 'keyfile', required: true, type: 'string' },
    s: { alias: 'symbols', required: true, type: 'string' },
    v: {
      alias: 'verbose',
      required: false,
      type: 'boolean',
      default: true,
    },
  }).argv;

  const marginAccount = new SolanaMarginAccount(
    args.c,
    args.v,
    args.k,
    args.s.split(','),
  );

  const mainnetConfiguration = new Configuration(
    'mainnet-beta',
    marginAccount.configuration.verbose,
    marginAccount.symbols,
  );
  const mainnetConnection = new Connection(
    mainnetConfiguration.url,
    marginAccount.configuration.verbose,
  );
  const oracles: Record<string, PythOracle> = {};
  for (const oracleConfig of Object.values<OracleConfiguration>(
    mainnetConfiguration.oracles,
  )) {
    oracles[oracleConfig.symbol] = new PythOracle(
      oracleConfig,
      mainnetConnection,
    );
  }
  await PythOracle.load(mainnetConnection, Object.values<PythOracle>(oracles));

  await marginAccount.load();

  const bot: Bot = createBot(args.b, marginAccount, oracles);

  await marginAccount.createTokenAccounts();
  await marginAccount.createOpenOrders();

  const crank =
    marginAccount.configuration.cluster == 'devnet' ||
    marginAccount.configuration.cluster == 'localnet'
      ? new Crank(marginAccount)
      : undefined;

  for (const oracle of Object.values<PythOracle>(oracles)) {
    await oracle.listen();
  }

  await marginAccount.listen();

  const controller = new Controller(marginAccount, crank);

  console.log(`MARKET MAKER RUNNING - Press Ctrl+C to exit.`);
  console.log(``);

  while (controller.isRunning) {
    try {
      bot.process();
    } catch (e) {
      console.log(e);
    }

    if (crank) {
      try {
        crank.process();
      } catch (e) {
        console.log(e);
      }
    }

    await sleep(controller.interval);
  }

  console.log(`MARKET MAKER STOPPING`);
}

run();
