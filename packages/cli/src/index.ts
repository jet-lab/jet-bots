#!/usr/bin/env ts-node

import chalk from 'chalk';
import figlet from 'figlet';
import yargs from 'yargs/yargs';

import {
  MarginAccount,
  Market,
  SerumMarket,
  SolanaMarginAccount,
} from '../../bot-sdk/src/';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForExit() {
  let isRunning = true;

  process.on('SIGINT', async () => {
    isRunning = false;
    await sleep(1000);
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

  while (isRunning) {
    await sleep(1000);
  }
}

async function run() {
  const commands = {
    airdrop: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        s: { alias: 'symbol', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      await marginAccount.airdrop(argv.s, argv.a);
    },
    asks: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        m: { alias: 'market', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v);
      await marginAccount.printAsks(argv.m);
    },
    'ask-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        m: { alias: 'market', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v);
      await marginAccount.printAskOrders(argv.m);
    },
    balance: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      marginAccount.printBalance();
    },
    bids: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        m: { alias: 'market', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v);
      await marginAccount.printBids(argv.m);
    },
    'bid-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        m: { alias: 'market', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v);
      await marginAccount.printBidOrders(argv.m);
    },
    'cancel-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      await marginAccount.cancelOrders();
    },
    close: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      await marginAccount.closeMarginAccount();
    },
    'close-open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.closeOpenOrders();
    },
    crank: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      for (const market of Object.values<Market>(marginAccount.markets)) {
        if (market instanceof SerumMarket) {
          await market.crank();
        }
      }
    },
    create: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      await SolanaMarginAccount.createMarginAccount(argv.c, argv.k);
    },
    'create-open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      await marginAccount.createOpenOrders();
    },
    'create-token-accounts': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      await marginAccount.createTokenAccounts();
    },
    deposit: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        t: { alias: 'token', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      await marginAccount.deposit(argv.t, argv.a);
    },
    'listen-open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      for (const market of Object.values<Market>(marginAccount.markets)) {
        if (market instanceof SerumMarket) {
          await market.listenOpenOrders();
        }
      }
      await waitForExit();
    },
    'open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      marginAccount.printOpenOrders();
    },
    'send-test-order': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        m: { alias: 'market', required: true, type: 'string' },
        p: { alias: 'price', required: true, type: 'number' },
        s: { alias: 'size', required: true, type: 'number' },
        t: { alias: 'token', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      marginAccount.sendTestOrder(argv.m, argv.t, argv.p, argv.s);
      const market = marginAccount.markets[argv.m];
      await market.crank();
    },
    'settle-funds': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      await marginAccount.settleFunds();
    },
    withdraw: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        s: { alias: 'symbol', required: true, type: 'string' },
        v: {
          alias: 'verbose',
          required: false,
          type: 'boolean',
          default: true,
        },
      }).argv;
      const marginAccount = new SolanaMarginAccount(argv.c, argv.v, argv.k);
      await marginAccount.load();
      await marginAccount.withdraw(argv.s, argv.a);
    },
  };

  const command = process.argv.slice(2, 3)[0];
  if (!command || !commands[command]) {
    console.log(`Unknown command: ${command}.`);
  } else {
    console.log('');
    console.log(
      chalk.cyan(figlet.textSync(`jet-bots`, { horizontalLayout: 'full' })),
    );
    console.log('');
    commands[command]();
  }
}

run();
