#!/usr/bin/env ts-node

import {
  Account,
  Cluster,
  Commitment,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';
import yargs from 'yargs/yargs';

import { MarginAccount, Position } from '../../bot-sdk/src/';

//TODO load this from a package.
import CONFIG from '../../bot-sdk/src/config.json';

async function run() {
  //TODO if you don't pass in args then show usage.

  const command = process.argv.slice(2, 3)[0];

  console.log(`jet ${command}`);

  switch (command) {
    case 'airdrop': {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        s: { alias: 'symbol', required: true, type: 'string' },
      }).argv;

      const marginAccount = await loadMarginAccount(argv);

      await marginAccount.airdrop(argv.s, argv.a);

      //TODO print out the transaction.

      break;
    }
    case 'balance': {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;

      const marginAccount = await loadMarginAccount(argv);

      console.log('');
      console.log(
        `Payer balance = ${(
          marginAccount.payerBalance / LAMPORTS_PER_SOL
        ).toFixed(2)} SOL`,
      );
      for (const position of Object.values<Position>(marginAccount.positions)) {
        console.log(
          `  ${position.symbol} token balance = ${(
            Number(position.balance) /
            10 ** position.decimals
          ).toFixed(2)}`,
        );
      }
      console.log('');

      break;
    }
    case 'close': {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;

      const marginAccount = await loadMarginAccount(argv);

      await marginAccount.closeMarginAccount();

      break;
    }
    case 'create': {
      const argv = await yargs(process.argv.slice(3)).options({
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;

      const marginAccount = await createMarginAccount(argv);

      break;
    }
    case 'deposit': {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        s: { alias: 'symbol', required: true, type: 'string' },
      }).argv;

      const marginAccount = await loadMarginAccount(argv);

      await marginAccount.deposit(argv.s, argv.a);

      break;
    }
    case 'withdraw': {
      const argv = await yargs(process.argv.slice(3)).options({
        a: { alias: 'amount', required: true, type: 'number' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        s: { alias: 'symbol', required: true, type: 'string' },
      }).argv;

      const marginAccount = await loadMarginAccount(argv);

      await marginAccount.withdraw(argv.s, argv.a);

      break;
    }
    default: {
      //TODO show usage.
      break;
    }
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

  await marginAccount.load();

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

async function loadMarginAccount(argv: any): Promise<MarginAccount> {
  const config = loadConfig(argv.c);

  const connection = new Connection(config.url, 'processed' as Commitment);

  const account = new Account(JSON.parse(fs.readFileSync(argv.k, 'utf-8')));

  const marginAccount = new MarginAccount({
    config,
    connection,
    owner: account,
    payer: account,
  });

  await marginAccount.load();

  return marginAccount;
}

run();
