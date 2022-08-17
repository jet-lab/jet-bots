#!/usr/bin/env ts-node

import yargs from 'yargs/yargs';

import { MarginAccount } from '../../bot-sdk/src/';

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
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      await marginAccount.airdrop(argv.s, argv.a);
    },
    asks: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        m: { alias: 'market', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c);
      await marginAccount.printAsks(argv.m);
    },
    'ask-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        m: { alias: 'market', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c);
      await marginAccount.printAskOrders(argv.m);
    },
    balance: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      marginAccount.printBalance();
    },
    bids: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        m: { alias: 'market', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c);
      await marginAccount.printBids(argv.m);
    },
    'bid-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        m: { alias: 'market', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c);
      await marginAccount.printBidOrders(argv.m);
    },
    'cancel-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      await marginAccount.cancelOrders();
    },
    close: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      await marginAccount.closeMarginAccount();
    },
    'close-open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.closeOpenOrders();
    },
    create: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      await MarginAccount.createMarginAccount(argv.c, argv.k);
    },
    'create-open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      await marginAccount.createOpenOrders();
    },
    'create-token-accounts': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      await marginAccount.createTokenAccounts();
    },
    deposit: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        t: { alias: 'token', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      await marginAccount.deposit(argv.t, argv.a);
    },
    'listen-open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      await marginAccount.listenOpenOrders();
      await waitForExit();
    },
    'open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
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
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      marginAccount.sendTestOrder(argv.m, argv.t, argv.p, argv.s);
    },
    'settle-funds': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      await marginAccount.settleFunds();
    },
    withdraw: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        s: { alias: 'symbol', required: true, type: 'string' },
      }).argv;
      const marginAccount = new MarginAccount(argv.c, argv.k);
      await marginAccount.load();
      await marginAccount.withdraw(argv.s, argv.a);
    },
  };

  const command = process.argv.slice(2, 3)[0];
  if (!command || !commands[command]) {
    console.log(`Unknown command: ${command}.`);
  } else {
    console.log('');
    console.log(`jet ${command}`);
    console.log('');
    commands[command]();
  }
}

run();
