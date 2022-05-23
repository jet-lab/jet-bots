#!/usr/bin/env ts-node

import { Market, Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { Commitment, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import assert from 'assert';

import { Configuration, loadConfig } from './configuration';
import { Controller } from './controller';
import { Oracle } from './oracle';
import { createStrategy } from './strategies';
import { Strategy } from './strategies/strategy';
import { sleep } from './utils';

async function run() {

  const configuration = new Configuration();
  const mainnetConfig = loadConfig('mainnet');

  const connection = new Connection(configuration.config.url, 'processed' as Commitment);
  const mainnetConnection = new Connection(mainnetConfig.url, 'processed' as Commitment);

  assert(configuration.config.serumProgramId);
  const serumProgramId = new PublicKey(configuration.config.serumProgramId);
  assert(mainnetConfig.serumProgramId);
  const mainnetSerumProgramId = new PublicKey(mainnetConfig.serumProgramId);

  const marketConfigs = Object.keys(configuration.config.markets).map((key) => { return configuration.config.markets[key]; });
  const oracleConfigs = Object.keys(mainnetConfig.oracles).map((key) => { return mainnetConfig.oracles[key]; });

  const mainnetMarketConfigs = Object.keys(mainnetConfig.markets).map((key) => { return mainnetConfig.markets[key]; });

  assert(marketConfigs.length == oracleConfigs.length);
  assert(marketConfigs.length == mainnetMarketConfigs.length);
  for (let i = 0; i < marketConfigs.length; i++) {
    assert(marketConfigs[i].baseSymbol == oracleConfigs[i].baseSymbol);
    assert(marketConfigs[i].symbol == mainnetMarketConfigs[i].symbol);
  }

  const oracles = oracleConfigs.map((oracleConfig) => {
    assert(oracleConfig.address);
    assert(mainnetConfig.pythProgramId);
    return new Oracle(oracleConfig, mainnetConnection, new PublicKey(oracleConfig.address), new PublicKey(mainnetConfig.pythProgramId));
  });
  assert(oracles.length == marketConfigs.length);
  for (let i = 0; i < oracles.length; i++) {
    assert(oracles[i].config.baseSymbol == marketConfigs[i].baseSymbol);
  }

  const markets: Market[] = [];
  const mainnetMarkets: Market[] = [];
  for (let i = 0; i < marketConfigs.length; i++) {
    markets.push(await Market.load(connection, new PublicKey(marketConfigs[i].market), { skipPreflight: true, commitment: 'processed' }, serumProgramId));
    mainnetMarkets.push(await Market.load(mainnetConnection, new PublicKey(mainnetMarketConfigs[i].market), { skipPreflight: true, commitment: 'processed' }, mainnetSerumProgramId));
  }
  assert(markets.length == marketConfigs.length);
  assert(mainnetMarkets.length == marketConfigs.length);

  const strategies: Strategy[] = [];
  for (const type of configuration.strategies) {
    strategies.push(await createStrategy(type, connection, marketConfigs, markets, mainnetConnection, mainnetMarkets));
  }

  console.log(`MAKING MARKETS`);

  if (configuration.cancelOpenOrders) {
    for (const strategy of strategies) {
      await strategy.cancelOpenOrders();
    }
  }

  const controller = new Controller(strategies);

  while (controller.isRunning) {
    try {

      for (let marketIndex = 0; marketIndex < markets.length; marketIndex++) {

        const [ asks, bids, price ]: [ Orderbook, Orderbook, void] = await Promise.all([
          await markets[marketIndex].loadAsks(connection),
          await markets[marketIndex].loadBids(connection),
          await oracles[marketIndex].fetchPrice(),
        ]);

        if (configuration.verbose && asks && bids) {
          console.log(`asks = ${JSON.stringify(asks.getL2(10))}`);
          console.log(`bids = ${JSON.stringify(bids.getL2(10))}`);
        }

        for (let strategyIndex = 0; strategyIndex < strategies.length; strategyIndex++) {

          const [ openOrders ]: [ Order[], void] = await Promise.all([
            await markets[marketIndex].loadOrdersForOwner(connection, strategies[strategyIndex].account.publicKey),
            await strategies[strategyIndex].positions[marketIndex].fetchBalances(),
          ]);

          if (configuration.verbose) {
            console.log(`Account balance = ${strategies[strategyIndex].positions[marketIndex].balance / LAMPORTS_PER_SOL} SOL`);
            console.log(`Base token balance = ${JSON.stringify(strategies[strategyIndex].positions[marketIndex].baseTokenBalance)}`);
            console.log(`Quote token balance = ${JSON.stringify(strategies[strategyIndex].positions[marketIndex].quoteTokenBalance)}`);
          }

          const [ newOrders, cancelOrders ]: [OrderParams[], Order[]] = await strategies[strategyIndex].update(marketIndex, asks, bids, openOrders);

          await strategies[strategyIndex].updateOrders(markets[marketIndex], newOrders, cancelOrders);

          if (strategies[strategyIndex].positions[marketIndex].baseTokenBalance != 0 || strategies[strategyIndex].positions[marketIndex].quoteTokenBalance != 0) {
            await strategies[strategyIndex].positions[marketIndex].settleFunds();
          }

        }

      }

    } catch (e) {
      console.log(e);
    } finally {
      if (configuration.verbose) {
        console.log(`${new Date().toUTCString()} sleeping for ${controller.interval / 1000}s`);
        console.log('');
      }
      await sleep(controller.interval);
    }
  }

  console.log(`MARKET MAKER STOPPING`);

}

run();
