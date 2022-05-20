#!/usr/bin/env ts-node
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';

import { decodeEventQueue, OpenOrders } from "@project-serum/serum";
import { parsePriceData } from '@pythnetwork/client'
import { Account, Commitment, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

import { loadConfig } from './configuration';
import { findOpenOrdersAccounts, getAssociatedTokenAddress, toPriceLevels } from './utils';

async function monitor() {

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

  const openOrdersAccount = new Account(
    JSON.parse(
      fs.readFileSync(
        process.env.KEYPAIR || os.homedir() + '/.config/solana/open_orders.json',
        'utf-8',
      ),
    ),
  );



  //const config = loadConfig('localnet');
  const config = loadConfig('devnet');
  const mainnetConfig = loadConfig('mainnet');

  assert(config.splTokenFaucet);
  const splTokenFaucet = new PublicKey(config.splTokenFaucet);

  assert(config.serumProgramId);
  const serumProgramId = new PublicKey(config.serumProgramId);

  assert(mainnetConfig.serumProgramId);
  const mainnetSerumProgramId = new PublicKey(mainnetConfig.serumProgramId);

  const connection = new Connection(config.url, 'processed' as Commitment);
  const mainnetConnection = new Connection(mainnetConfig.url, 'processed' as Commitment);



  const oracles = Object.keys(mainnetConfig.oracles).map((key) => { return mainnetConfig.oracles[key]; });

  for (const oracle of oracles) {
    console.log(`ORACLE: ${oracle.symbol}`);

    const accountInfo = await mainnetConnection.getAccountInfo(new PublicKey(oracle.address));
    const pythPrice = parsePriceData(accountInfo!.data)
    assert(pythPrice.price);

    console.log(`  price = ${pythPrice.price}`);
    console.log(`  confidence = ${pythPrice.confidence}`);
    console.log('');
  }



  const markets = Object.keys(config.markets).map((key) => { return config.markets[key]; });

  for (const market of markets) {
    console.log(`MARKET: ${market.symbol}`);

    const eventQueueAccount = await connection.getAccountInfo(new PublicKey(market.eventQueue));
    const events = decodeEventQueue(eventQueueAccount!.data);
    for (const event of events) {
      console.log(`  event = ${JSON.stringify(event)}`);
    }

    const depth = 20;

    const asksAccount = await connection.getAccountInfo(new PublicKey(market.asks));
    console.log(`  asks = ${JSON.stringify(toPriceLevels((await connection.getAccountInfo(new PublicKey(market.asks)))!.data, depth, market.baseLotSize, market.baseDecimals, market.quoteLotSize, market.quoteDecimals))}`);

    const bidsAccount = await connection.getAccountInfo(new PublicKey(market.bids));
    console.log(`  bids = ${JSON.stringify(toPriceLevels((await connection.getAccountInfo(new PublicKey(market.bids)))!.data, depth, market.baseLotSize, market.baseDecimals, market.quoteLotSize, market.quoteDecimals))}`);



    const openOrdersAccountInfo = await connection.getAccountInfo(openOrdersAccount.publicKey);
    console.log(`  openOrdersAccountInfo = ${JSON.stringify(openOrdersAccountInfo)}`);

    const openOrdersAccounts = await findOpenOrdersAccounts(
      connection,
      new PublicKey(market.market),
      account.publicKey,
      serumProgramId,
      mainnetSerumProgramId,
    );

    console.log(`  openOrdersAccounts = ${JSON.stringify(openOrdersAccounts)}`);

    const openOrders = await OpenOrders.findForMarketAndOwner(
      connection,
      new PublicKey(market.market),
      account.publicKey,
      serumProgramId,
    );

    console.log(`  openOrdersAccountsForMarket = ${JSON.stringify(openOrders.length)}`);

    console.log('');
  }



  const balance = await connection.getBalance(payer.publicKey) / LAMPORTS_PER_SOL;

  console.log(`Account: ${account.publicKey.toBase58()}`);
  console.log(`  balance = ${JSON.stringify(balance)} SOL`);

  const tokens = Object.keys(config.tokens).map((key) => { return config.tokens[key]; });

  for (const token of tokens) {
    const tokenAccount = await getAssociatedTokenAddress(new PublicKey(token.mint), payer.publicKey);
    const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
    if (accountInfo.value) {
      const tokenBalance = (await connection.getTokenAccountBalance(tokenAccount)).value.uiAmount;
      console.log(`  ${token.symbol} tokens = ${tokenBalance}`);
    }
  }

  console.log('');



  // SCRATCH PAD
  if (true && false) {
    const accountInfo = await connection.getParsedAccountInfo(new PublicKey('29qQyadtiKexH3Vuri551eoEDXxZCYc3uAWDz2k6cAJw'));
    console.log(`${JSON.stringify(accountInfo)}`);
    console.log('');
  }

}

monitor();
