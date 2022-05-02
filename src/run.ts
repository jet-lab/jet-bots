#!/usr/bin/env ts-node

import { Commitment, Connection } from '@solana/web3.js';
import yargs from 'yargs/yargs';

import CONFIGURATION from './configuration.json';

function loadConfig(url: string)
{
  switch (url)
  {
    case 'd':
    case 'devnet':
      {
        return CONFIGURATION.devnet;
      }
    case 'l':
    case 'localhost':
      {
        return CONFIGURATION.localnet;
      }
    default:
      {
        throw new Error(`Invalid url: ${url}`);
      }
  }
}

function sleep(ms: number) { return new Promise( resolve => setTimeout(resolve, ms) ); }

(async() => {

  const argv: any = yargs(process.argv.slice(2)).options({
    c: { alias: 'cancel all open orders', default: true, type: 'boolean' },
    o: { alias: 'oracle', required: true, type: 'string' },
    s: { alias: 'symbol', required: true, type: 'string' },
    u: { alias: 'url', required: true, type: 'string' },
    v: { alias: 'verbose', default: false, type: 'boolean' },
  }).argv;

  const interval = 1000;

  const control = { isRunning: true, interval: interval };

  process.on('SIGINT', () => {
    console.log('Caught keyboard interrupt. Canceling orders');
    control.isRunning = false;
    //onExit(client, payer, mangoGroup, mangoAccount, marketContexts);
    //process.exit();
  });

  process.on('unhandledRejection', (err, promise) => {
    console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
  });

  const symbol: string = argv.s;
  const oracle: string = argv.o;
  const verbose: boolean = argv.v;

  const config = loadConfig(argv.u);

  const connection = new Connection(config.url, 'processed' as Commitment);

  // Load the market.

  if (argv.c) {

    // Cancel any open orders.

  }

  console.log(`MAKING A MARKET IN ${symbol}`);

  while (control.isRunning) {
    try {


      // Get the current base and quote balances.


      // If the user doesn't have tokens do nothing.


      // Get the oracle price.


      // Update orders.


    } catch (e) {
      console.log(e);
    } finally {
      if (verbose) {
        console.log(`${new Date().toUTCString()} sleeping for ${control.interval / 1000}s`);
      }
      await sleep(control.interval);
    }
  }

})();
