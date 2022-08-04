#!/usr/bin/env ts-node

import { BN } from "@project-serum/anchor";
import { Market, OpenOrders, Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { AccountInfo, Commitment, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
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

  //const oracles: Record<string, Oracle> = {};
  //for (const oracleConfig of Object.values<any>(mainnetConfig.oracles)) {
    //assert(oracleConfig.address);
    //assert(mainnetConfig.pythProgramId);
    //oracles[oracleConfig.symbol] = new Oracle(oracleConfig, mainnetConnection, new PublicKey(oracleConfig.address), new PublicKey(mainnetConfig.pythProgramId));
  //}

  const marketConfigs: Record<string, any> = {};
  const markets: Record<string, Market> = {};
  for (const marketConfig of Object.values<any>(configuration.config.markets)) {
    marketConfigs[marketConfig.symbol] = marketConfig;
    markets[marketConfig.symbol] = await Market.load(connection, new PublicKey(marketConfig.market), { skipPreflight: true, commitment: 'processed' }, serumProgramId);
  }

  const mainnetMarkets: Record<string, Market> = {};
  for (const mainnetMarketConfigs of Object.values<any>(mainnetConfig.markets)) {
    mainnetMarkets[mainnetMarketConfigs.symbol] = await Market.load(mainnetConnection, new PublicKey(mainnetMarketConfigs.market), { skipPreflight: true, commitment: 'processed' }, mainnetSerumProgramId);
  }

  const strategies: Strategy[] = [];
  for (const type of configuration.strategies) {
    strategies.push(await createStrategy(type, connection, configuration.config, marketConfigs, markets, mainnetConnection, mainnetMarkets));
  }

  const controller = new Controller(strategies);

  console.log(`MAKING MARKETS`);

  while (controller.isRunning) {

    for (const marketConfig of Object.values<any>(configuration.config.markets)) {
      try {
        const symbol = marketConfig.symbol;
        assert(markets[symbol]);

        //const oracleSymbol = marketConfig.baseSymbol + '/USD';
        //assert(oracles[oracleSymbol]);

        //const [ asks, bids, price ]: [ Orderbook, Orderbook, void] = await Promise.all([
        const [ asks, bids ]: [ Orderbook, Orderbook] = await Promise.all([
          await markets[symbol].loadAsks(connection),
          await markets[symbol].loadBids(connection),
          //await oracles[oracleSymbol].fetchPrice(),
        ]);

        if (configuration.verbose && asks && bids) {
          console.log(`asks = ${JSON.stringify(asks.getL2(10))}`);
          console.log(`bids = ${JSON.stringify(bids.getL2(10))}`);
        }

        for (let strategyIndex = 0; strategyIndex < strategies.length; strategyIndex++) {

          const [ openOrdersAccountInfo ]: [ AccountInfo<Buffer> | null, void] = await Promise.all([
            await connection.getAccountInfo(strategies[strategyIndex].positions[symbol].openOrdersAccount),
            await strategies[strategyIndex].positions[symbol].fetchBalances(),
          ]);

          if (configuration.verbose) {
            console.log(`Account balance = ${strategies[strategyIndex].positions[symbol].balance / LAMPORTS_PER_SOL} SOL`);
            console.log(`Base token balance = ${JSON.stringify(strategies[strategyIndex].positions[symbol].baseTokenBalance)}`);
            console.log(`Quote token balance = ${JSON.stringify(strategies[strategyIndex].positions[symbol].quoteTokenBalance)}`);
          }

          if (openOrdersAccountInfo) {
            const openOrders = OpenOrders.fromAccountInfo(
              strategies[strategyIndex].positions[symbol].openOrdersAccount,
              openOrdersAccountInfo,
              markets[symbol].programId,
            );

            const [ newOrders, cancelOrders ]: [OrderParams[], Order[]] = await strategies[strategyIndex].update(symbol, asks, bids, openOrders.orders.filter((orderId) => { return !orderId.eq(new BN(0)); }));

            await strategies[strategyIndex].updateOrders(markets[symbol], newOrders, cancelOrders);

            if (openOrders.baseTokenFree.gt(new BN(0)) || openOrders.quoteTokenFree.gt(new BN(0))) {
              await strategies[strategyIndex].positions[symbol].settleFunds();
            }
          }

        }
      } catch (e) {
        console.log(e);
      }
    }

    if (configuration.verbose) {
      console.log(`${new Date().toUTCString()} sleeping for ${controller.interval / 1000}s`);
      console.log('');
    }
    await sleep(controller.interval);
  }

  console.log(`MARKET MAKER STOPPING`);

}

run();
