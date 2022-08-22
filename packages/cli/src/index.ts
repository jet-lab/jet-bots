#!/usr/bin/env ts-node

import {
  Market,
  Protocol,
  SerumMarket,
  SolanaProtocol,
} from '@jet-lab/bot-sdk/src/index';
import chalk from 'chalk';
import figlet from 'figlet';
import yargs from 'yargs/yargs';

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
  const commands: any = {
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      await protocol.airdrop(argv.s, argv.a);
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
      const protocol = new SolanaProtocol(argv.c, argv.v);
      await protocol.printAsks(argv.m);
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
      const protocol = new SolanaProtocol(argv.c, argv.v);
      await protocol.printAskOrders(argv.m);
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      protocol.printBalance();
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
      const protocol = new SolanaProtocol(argv.c, argv.v);
      await protocol.printBids(argv.m);
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
      const protocol = new SolanaProtocol(argv.c, argv.v);
      await protocol.printBidOrders(argv.m);
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      await protocol.cancelOrders();
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      await protocol.closeAccount();
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.closeOpenOrders();
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      for (const market of Object.values<Market>(protocol.markets)) {
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
      await SolanaProtocol.createAccount(argv.c, argv.k);
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      await protocol.createOpenOrders();
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      await protocol.createTokenAccounts();
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      await protocol.deposit(argv.t, argv.a);
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      for (const market of Object.values<Market>(protocol.markets)) {
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      protocol.printOpenOrders();
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      protocol.sendTestOrder(argv.m, argv.t, argv.p, argv.s);
      const market = protocol.markets[argv.m];
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      await protocol.settleFunds();
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
      const protocol = new SolanaProtocol(argv.c, argv.v, argv.k);
      await protocol.load();
      await protocol.withdraw(argv.s, argv.a);
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
    await commands[command]();
  }
}

run();
