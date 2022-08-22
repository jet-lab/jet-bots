#!/usr/bin/env ts-node

import {
  Configuration,
  Connection,
  OracleConfiguration,
  Protocol,
  PythOracle,
  SolanaProtocol,
} from '@jet-lab/bot-sdk';
import { Keypair } from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';
import yargs from 'yargs/yargs';

import { Bot } from './bots/bot';
import { Crank } from './bots/crank';
import { Maker } from './bots/maker';
import { Taker } from './bots/taker';

function createBot(
  type: string,
  protocol: Protocol,
  oracles?: Record<string, PythOracle>,
): Bot {
  switch (type) {
    case 'maker':
      return new Maker(protocol, oracles!);
    case 'taker':
      assert(
        protocol.configuration.cluster == 'devnet' ||
          protocol.configuration.cluster == 'localnet',
      );
      return new Taker(protocol);
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

  constructor(protocol: Protocol, crank?: Crank) {
    process.on('SIGINT', async () => {
      console.log('Caught keyboard interrupt.');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

      try {
        await protocol.cancelOrders();
      } catch (err) {
        console.log(JSON.stringify(err));
      }

      if (crank) {
        try {
          await crank.process();
          await protocol.settleFunds();
        } catch (err) {
          console.log(JSON.stringify(err));
        }
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

  //TODO if the user is on devnet or localnet and they don't have account ask them if they want to create one, if not exit.

  /*
  if (!fs.existsSync(args.k)) {
    console.log(`Solana account '${args.k}' does not exist. Creating a new account.`);

    const keypair = Keypair.generate();
    fs.writeFileSync(args.k, '[' + keypair.secretKey.toString() + ']');

    //TODO airdrop some tokens to test with.
  }
  */

  const protocol = new SolanaProtocol(
    args.c,
    args.v,
    args.k,
    args.s.split(','),
  );

  const mainnetConfiguration = new Configuration(
    'mainnet-beta',
    protocol.configuration.verbose,
    protocol.symbols,
  );
  const mainnetConnection = new Connection(
    mainnetConfiguration.url,
    protocol.configuration.verbose,
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

  await protocol.load();

  //TODO if the user is on devnet or localnet and they don't have tokens ask them if they want to get airdrops.

  const bot: Bot = createBot(args.b, protocol, oracles);

  await protocol.createTokenAccounts();
  await protocol.createOpenOrders();

  const crank =
    protocol.configuration.cluster == 'devnet' ||
    protocol.configuration.cluster == 'localnet'
      ? new Crank(protocol)
      : undefined;

  for (const oracle of Object.values<PythOracle>(oracles)) {
    await oracle.listen();
  }

  await protocol.listen();

  const controller = new Controller(protocol, crank);

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
        await crank.process();
        await protocol.settleFunds();
      } catch (e) {
        console.log(e);
      }
    }

    await sleep(controller.interval);
  }

  console.log(`MARKET MAKER STOPPING`);
}

run();
