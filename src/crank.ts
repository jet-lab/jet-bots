#!/usr/bin/env ts-node
import { BN } from "@project-serum/anchor";
import { decodeEventQueue, DexInstructions } from "@project-serum/serum";
import { Account, Commitment, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';

import { Configuration, loadConfig } from './configuration';
import { getAssociatedTokenAddress, sleep } from './utils';

class CrankController {

  isRunning = true;
  interval = 1000;

  constructor(
  ) {
    process.on('SIGINT', async () => {
      console.log('Caught keyboard interrupt.');

      this.isRunning = false;

      // Wait for the main loop to  exit.
      await sleep(this.interval);

      process.exit();
    });

    process.on('unhandledRejection', (err, promise) => {
      console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
    });
  }

};

async function crank() {

  const account = new Account(
    JSON.parse(
      fs.readFileSync(
        process.env.KEYPAIR || os.homedir() + '/.config/solana/id.json',
        'utf-8',
      ),
    ),
  );

  // @ts-ignore
  const payer: Keypair = account;

  const config = loadConfig('localnet');
  const mainnetConfig = loadConfig('mainnet');

  const connection = new Connection(config.url, 'processed' as Commitment);

  const controller = new CrankController();

  assert(config.serumProgramId);
  const serumProgramId = new PublicKey(config.serumProgramId);

  const markets = Object.keys(config.markets).map((key) => { return config.markets[key]; });

  const tokens = Object.keys(config.tokens).map((key) => { return config.tokens[key]; });

  const consumeEventsLimit = new BN('10');
  const maxUniqueAccounts = parseInt('10');

  const feeTokenAccounts = new Map<string, PublicKey>();

  const tokenAccounts = await Promise.all(
    tokens.map(async (token) => {
      return [token, await getAssociatedTokenAddress(new PublicKey(token.mint), payer.publicKey)];
    })
  );

  tokenAccounts.forEach(([token, tokenAccount]) => {
    feeTokenAccounts.set(token.mint, tokenAccount);
  })

  while (controller.isRunning) {
    try {

      let balance = await connection.getBalance(payer.publicKey) / LAMPORTS_PER_SOL;

      while (balance < 2) {
        const airdropSignature = await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSignature, 'confirmed' as Commitment);
        await sleep(2000);
        balance = await connection.getBalance(payer.publicKey) / LAMPORTS_PER_SOL;
        console.log(`  Balance = ${balance} SOL`);
        console.log('');
      }

      await Promise.all(markets.map(async (market) => {
        const accountInfo = await connection.getAccountInfo(new PublicKey(market.eventQueue));
        if (accountInfo) {
          const events = decodeEventQueue(accountInfo.data);
          if (events.length > 0) {
            const accounts: Set<PublicKey> = new Set();
            for (const event of events) {
              accounts.add(event.openOrders);
              if (accounts.size >= maxUniqueAccounts) break;
              console.log(`consumeEvents(${accounts.size})`);
              const openOrdersAccounts = [...accounts]
                .map((s) => new PublicKey(s))
                .sort((a, b) => a.toBuffer().swap64().compare(b.toBuffer().swap64()));
              let transaction = new Transaction().add(
                DexInstructions.consumeEvents({
                  market: new PublicKey(market.market),
                  eventQueue: new PublicKey(market.eventQueue),
                  coinFee: feeTokenAccounts.get(market.baseMint),
                  pcFee: feeTokenAccounts.get(market.quoteMint),
                  openOrdersAccounts,
                  limit: consumeEventsLimit,
                  programId: serumProgramId,
                })
              );
              transaction.feePayer = payer.publicKey;
              await connection.sendTransaction(transaction, [payer]);
            }
          }
        }
      }));

    } catch (e) {
      console.log(e);
    } finally {
      await sleep(controller.interval);
    }
  }

}

crank();
