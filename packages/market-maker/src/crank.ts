#!/usr/bin/env ts-node

import { BN } from '@project-serum/anchor';
import { decodeEventQueue, DexInstructions } from '@project-serum/serum';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import assert from 'assert';

import {
  Configuration,
  MarketConfiguration,
  TokenConfiguration,
} from '../../bot-sdk/src'; //TODO reference a package.

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function crank() {
  const payer = Keypair.generate();

  const configuration = new Configuration('devnet');

  const connection = new Connection(
    configuration.url,
    'processed' as Commitment,
  );

  assert(configuration.serumProgramId);
  const serumProgramId = new PublicKey(configuration.serumProgramId);

  const markets = Object.values<MarketConfiguration>(configuration.markets);
  const tokens = Object.values<TokenConfiguration>(configuration.tokens);

  const consumeEventsLimit = new BN('10');
  const maxUniqueAccounts = parseInt('10');

  const feeTokenAccounts = new Map<string, PublicKey>();

  const tokenAccounts = await Promise.all(
    tokens.map(async (tokenConfiguration: TokenConfiguration) => {
      return {
        tokenConfiguration: tokenConfiguration,
        tokenAccount: await getAssociatedTokenAddress(
          tokenConfiguration.mint,
          payer.publicKey,
        ),
      };
    }),
  );

  tokenAccounts.forEach(({ tokenConfiguration, tokenAccount }) => {
    feeTokenAccounts.set(tokenConfiguration.mint.toBase58(), tokenAccount);
  });

  const interval = 1000;
  let isRunning = true;

  process.on('SIGINT', async () => {
    console.log('Caught keyboard interrupt. Exiting.');

    isRunning = false;

    // Wait for the main loop to  exit.
    await sleep(interval);

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

  console.log(`RUNNING SERUM CRANK`);

  while (isRunning) {
    try {
      let balance =
        (await connection.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL;

      while (balance < 2) {
        const airdropSignature = await connection.requestAirdrop(
          payer.publicKey,
          2 * LAMPORTS_PER_SOL,
        );
        await connection.confirmTransaction(
          airdropSignature,
          'confirmed' as Commitment,
        );
        await sleep(2000);
        balance =
          (await connection.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL;
        console.log(`  Balance = ${balance} SOL`);
        console.log('');
      }

      for (const market of markets) {
        const accountInfo = await connection.getAccountInfo(
          new PublicKey(market.eventQueue),
        );
        if (accountInfo) {
          const events = decodeEventQueue(accountInfo.data);
          if (events.length > 0) {
            const accounts: Set<PublicKey> = new Set();
            for (const event of events) {
              accounts.add(event.openOrders);
              if (accounts.size >= maxUniqueAccounts) break;
              console.log(`consumeEvents(${accounts.size})`);
              const openOrdersAccounts = [...accounts]
                .map(s => new PublicKey(s))
                .sort((a, b) =>
                  a.toBuffer().swap64().compare(b.toBuffer().swap64()),
                );
              const transaction = new Transaction().add(
                DexInstructions.consumeEvents({
                  market: new PublicKey(market.market),
                  eventQueue: new PublicKey(market.eventQueue),
                  coinFee: feeTokenAccounts.get(market.baseMint.toBase58()),
                  pcFee: feeTokenAccounts.get(market.quoteMint.toBase58()),
                  openOrdersAccounts,
                  limit: consumeEventsLimit,
                  programId: serumProgramId,
                }),
              );
              transaction.feePayer = payer.publicKey;
              await connection.sendTransaction(transaction, [payer]);
              await sleep(interval);
            }
          }
        }
      }
    } catch (e) {
      console.log(e);
    } finally {
      await sleep(interval);
    }
  }
}

crank();
