#!/usr/bin/env ts-node

import { decodeEventQueue, Market, MARKET_STATE_LAYOUT_V3, OpenOrders } from "@project-serum/serum";
import { _OPEN_ORDERS_LAYOUT_V2 } from "@project-serum/serum/lib/market";
import { parsePriceData } from '@pythnetwork/client'
import { MintLayout } from '@solana/spl-token';
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



  const tokens = Object.keys(config.tokens).map((key) => { return config.tokens[key]; });

  for (const token of tokens) {
    console.log(`TOKEN: ${token.symbol}`);
    const mintAccount = await connection.getAccountInfo(new PublicKey(token.mint));
    if (mintAccount) {
      const mint = MintLayout.decode(mintAccount.data);
      console.log(`  supply = ${Number(mint.supply)}`);
    }
    console.log('');
  }



  const oracles = Object.keys(mainnetConfig.oracles).map((key) => { return mainnetConfig.oracles[key]; });

  for (const oracle of oracles) {
    console.log(`ORACLE: ${oracle.symbol}`);
    const oracleAccount = await mainnetConnection.getAccountInfo(new PublicKey(oracle.address));
    const pythPrice = parsePriceData(oracleAccount!.data)
    if (pythPrice.price) {
      assert(pythPrice.price);
      console.log(`  price = ${pythPrice.price}`);
      console.log(`  confidence = ${pythPrice.confidence}`);
    }
    console.log('');
  }



  const markets = Object.keys(config.markets).map((key) => { return config.markets[key]; });

  for (const market of markets) {
    console.log(`MARKET: ${market.symbol}`);
    const marketAccount = await connection.getAccountInfo(new PublicKey(market.market));
    if (marketAccount) {

      const marketState = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);
      console.log(`  quoteFeesAccrued = ${marketState.quoteFeesAccrued}`);
      console.log(`  referrerRebatesAccrued = ${marketState.referrerRebatesAccrued}`);

      const eventQueueAccount = await connection.getAccountInfo(new PublicKey(market.eventQueue));
      if (eventQueueAccount) {
        const events = decodeEventQueue(eventQueueAccount!.data);
        for (const event of events) {
          console.log(`  event = ${JSON.stringify(event)}`);
        }
      }

      const depth = 20;

      const asksAccount = await connection.getAccountInfo(new PublicKey(market.asks));
      if (asksAccount) {
        console.log(`  asks = ${JSON.stringify(toPriceLevels(asksAccount.data, depth, market.baseLotSize, market.baseDecimals, market.quoteLotSize, market.quoteDecimals))}`);
      }

      const bidsAccount = await connection.getAccountInfo(new PublicKey(market.bids));
      if (bidsAccount) {
        console.log(`  bids = ${JSON.stringify(toPriceLevels(bidsAccount.data, depth, market.baseLotSize, market.baseDecimals, market.quoteLotSize, market.quoteDecimals))}`);
      }



      for (const account of accounts) {
        const openOrdersAccounts = await findOpenOrdersAccounts(
          connection,
          new PublicKey(market.market),
          account.publicKey,
          serumProgramId,
        );

        console.log(`  openOrdersAccounts = ${JSON.stringify(openOrdersAccounts)}`);

        for (const openOrdersAccount of openOrdersAccounts) {
          const accountInfo = await connection.getAccountInfo(openOrdersAccount);
          assert(accountInfo);
          const openOrders = _OPEN_ORDERS_LAYOUT_V2.decode(accountInfo.data);
          console.log(`    openOrdersAccount = ${openOrdersAccount}`);
          console.log(`    openOrders.owner = ${openOrders.owner}`);
          console.log(`    openOrders.referrerRebatesAccrued = ${Number(openOrders.referrerRebatesAccrued)}`);
        }
      }

    }
    console.log('');
  }



  for (const account of accounts) {
    const balance = await connection.getBalance(account.publicKey) / LAMPORTS_PER_SOL;

    console.log(`Account: ${account.publicKey.toBase58()}`);
    console.log(`  balance = ${JSON.stringify(balance)} SOL`);

    for (const token of tokens) {
      const tokenAddress = await getAssociatedTokenAddress(new PublicKey(token.mint), account.publicKey);
      const tokenAccount = await connection.getParsedAccountInfo(tokenAddress);
      if (tokenAccount.value) {
        const tokenBalance = (await connection.getTokenAccountBalance(tokenAddress)).value.uiAmount;
        console.log(`  ${token.symbol} tokens = ${tokenBalance}`);
        console.log(`    tokenAccount = ${tokenAddress}`);
      }
    }

    console.log('');
  }

}

monitor();
