#!/usr/bin/env ts-node

import { Account, Commitment, Connection } from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';
import yargs from 'yargs/yargs';

import { MarginAccount } from '../../bot-sdk/src/';

//TODO load this from a package.
import CONFIG from '../../bot-sdk/src/config.json';

async function run() {
  const commands = {
    airdrop: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        s: { alias: 'symbol', required: true, type: 'string' },
      }).argv;
      const marginAccount = await getMarginAccount(argv);
      await marginAccount.load();
      await marginAccount.airdrop(argv.s, argv.a);
      //TODO print out the transaction.
    },
    balance: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = await getMarginAccount(argv);
      await marginAccount.load();
      marginAccount.printBalance();
    },
    'cancel-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = await getMarginAccount(argv);
      await marginAccount.load();
      marginAccount.cancelOrders();
    },
    close: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = await getMarginAccount(argv);
      await marginAccount.load();
      await marginAccount.closeMarginAccount();
    },
    create: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = await createMarginAccount(argv);
      await marginAccount.load();
    },
    'create-open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = await getMarginAccount(argv);
      await marginAccount.load();
      await marginAccount.createOpenOrders();
      marginAccount.printOpenOrders();
    },
    deposit: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        t: { alias: 'token', required: true, type: 'string' },
      }).argv;
      const marginAccount = await getMarginAccount(argv);
      await marginAccount.load();
      await marginAccount.deposit(argv.t, argv.a);
    },
    'open-orders': async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      const marginAccount = await getMarginAccount(argv);
      await marginAccount.load();
      marginAccount.printOpenOrders();
    },
    withdraw: async () => {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        s: { alias: 'symbol', required: true, type: 'string' },
      }).argv;
      const marginAccount = await getMarginAccount(argv);
      await marginAccount.load();
      await marginAccount.withdraw(argv.s, argv.a);
    },
  };

  const command = process.argv.slice(2, 3)[0];
  if (!command || !commands[command]) {
    console.log(`Unknown command: ${command}.`);
  } else {
    console.log(`jet ${command}`);
    commands[command]();
  }
}

async function createMarginAccount(argv: any): Promise<MarginAccount> {
  const config = loadConfig(argv.c);
  const connection = new Connection(config.url, 'processed' as Commitment);
  const account = new Account(JSON.parse(fs.readFileSync(argv.k, 'utf-8')));
  const marginAccount = await MarginAccount.createMarginAccount({
    config,
    connection,
    owner: account,
    payer: account,
  });
  return marginAccount;
}

async function getMarginAccount(argv: any): Promise<MarginAccount> {
  const config = loadConfig(argv.c);
  const connection = new Connection(config.url, 'processed' as Commitment);
  const account = new Account(JSON.parse(fs.readFileSync(argv.k, 'utf-8')));
  const marginAccount = new MarginAccount({
    config,
    connection,
    owner: account,
    payer: account,
  });
  return marginAccount;
}

function loadConfig(cluster: string): any {
  switch (cluster) {
    case 'd':
    case 'devnet': {
      assert(CONFIG.devnet);
      return CONFIG.devnet;
    }
    case 'l':
    case 'localnet': {
      assert(CONFIG.localnet);
      return CONFIG.localnet;
    }
    case 'm':
    case 'mainnet':
    case 'mainnet-beta': {
      assert(CONFIG['mainnet-beta']);
      return CONFIG['mainnet-beta'];
    }
    default: {
      throw new Error(`Invalid cluster: ${cluster}`);
    }
  }
}

run();
