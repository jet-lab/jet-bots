#!/usr/bin/env ts-node

import { decodeEventQueue, Market, OpenOrders } from "@project-serum/serum";
import { parsePriceData } from '@pythnetwork/client'
import { Account, Commitment, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';

import { loadConfig } from './configuration';
import { findOpenOrdersAccounts, getAssociatedTokenAddress, toPriceLevels } from './utils';

async function monitor() {

  const accounts = [
    new Account(JSON.parse(fs.readFileSync(os.homedir() + `/.config/solana/maker.json`, 'utf-8'))),
    new Account(JSON.parse(fs.readFileSync(os.homedir() + `/.config/solana/taker.json`, 'utf-8'))),
  ];



  //const config = loadConfig('localnet');
  const config = loadConfig('devnet');
  const mainnetConfig = loadConfig('mainnet');

  assert(config.splTokenFaucet);
  const splTokenFaucet = new PublicKey(config.splTokenFaucet);

  assert(config.serumProgramId);
  const serumProgramId = new PublicKey(config.serumProgramId);

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



    //const openOrdersAccountInfo = await connection.getAccountInfo(openOrdersAccount.publicKey);
    //console.log(`  openOrdersAccountInfo = ${JSON.stringify(openOrdersAccountInfo)}`);

    for (const account of accounts) {
      const openOrdersAccounts = await findOpenOrdersAccounts(
        connection,
        new PublicKey(market.market),
        account.publicKey,
        serumProgramId,
      );

      console.log(`  openOrdersAccounts = ${JSON.stringify(openOrdersAccounts)}`);
    }

    console.log('');
  }



  for (const account of accounts) {
    const balance = await connection.getBalance(account.publicKey) / LAMPORTS_PER_SOL;

    console.log(`Account: ${account.publicKey.toBase58()}`);
    console.log(`  balance = ${JSON.stringify(balance)} SOL`);

    const tokens = Object.keys(config.tokens).map((key) => { return config.tokens[key]; });

    for (const token of tokens) {
      const tokenAccount = await getAssociatedTokenAddress(new PublicKey(token.mint), account.publicKey);
      const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
      if (accountInfo.value) {
        const tokenBalance = (await connection.getTokenAccountBalance(tokenAccount)).value.uiAmount;
        console.log(`  ${token.symbol} tokens = ${tokenBalance}`);
      }
    }

    console.log('');
  }

}

monitor();
