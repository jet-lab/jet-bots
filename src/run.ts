#!/usr/bin/env ts-node

import { Market } from "@project-serum/serum";
import { Account, Commitment, Connection, PublicKey } from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';

import { Configuration, loadConfig } from './configuration';
import { Controller } from './controller';
import { Oracle } from './oracle';
import { OrderManager } from './orderManager';
import { PositionManager } from './positionManager';
import { getAssociatedTokenAddress, sleep } from './utils';

(async () => {

  const account = new Account(
    JSON.parse(
      fs.readFileSync(
        process.env.KEYPAIR || os.homedir() + '/.config/solana/id.json',
        'utf-8',
      ),
    ),
  );

  const openOrdersAccount = new Account(
    JSON.parse(
      fs.readFileSync(
        process.env.KEYPAIR || os.homedir() + '/.config/solana/open_orders.json',
        'utf-8',
      ),
    ),
  );

  const configuration = new Configuration(account, openOrdersAccount);
  const mainnetConfig = loadConfig('mainnet');

  const connection = new Connection(configuration.config.url, 'processed' as Commitment);

  // Pull live Pyth prices from mainnet.
  const mainnetConnection = new Connection('https://api.mainnet-beta.solana.com/', 'processed' as Commitment);

  assert(configuration.config.serumProgramId);
  const serumProgramId = new PublicKey(configuration.config.serumProgramId);

  assert(mainnetConfig.serumProgramId);
  const mainnetSerumProgramId = new PublicKey(mainnetConfig.serumProgramId);

  const market = await Market.load(connection, new PublicKey(configuration.market.market), { skipPreflight: true, commitment: 'processed' }, serumProgramId);
  const mainnetMarket = await Market.load(mainnetConnection, new PublicKey(configuration.mainnetMarket.market), { skipPreflight: true, commitment: 'processed' }, mainnetSerumProgramId);

  const oracle = new Oracle(configuration, mainnetConfig, mainnetConnection);

  const tokens = Object.keys(configuration.config.tokens).map((key) => { return configuration.config.tokens[key]; });

  const asz = configuration.symbol.split('/');
  const baseToken = tokens.find((token) => { return token.symbol == asz[0]; })!;
  const quoteToken = tokens.find((token) => { return token.symbol == asz[1]; })!;

  const baseTokenAccount = await getAssociatedTokenAddress(new PublicKey(baseToken.mint), account.publicKey);
  const quoteTokenAccount = await getAssociatedTokenAddress(new PublicKey(quoteToken.mint), account.publicKey);

  const positionManager = new PositionManager(configuration, connection, baseTokenAccount, quoteTokenAccount);
  await positionManager.init();

  const orderManager: OrderManager = new OrderManager(configuration, connection, mainnetConnection, market, mainnetMarket, oracle, positionManager);
  await orderManager.init();

  if (configuration.cancelOpenOrders) {
    await orderManager.cancelOpenOrders();
  }

  console.log(`MAKING A MARKET IN ${configuration.symbol}`);

  const controller = new Controller();

  while (controller.isRunning) {
    try {

      const [ asks, bids, openOrders ] = await Promise.all([
        await market.loadAsks(connection),
        await market.loadBids(connection),
        await market.loadOrdersForOwner(connection, account.publicKey),
        await oracle.fetchPrice(),
        await positionManager.fetchPositions(),
      ]);

      if (configuration.verbose && asks && bids) {
        console.log(`asks = ${JSON.stringify(asks.getL2(10))}`);
        console.log(`bids = ${JSON.stringify(bids.getL2(10))}`);
      }

      await orderManager.updateOrders(asks, bids, openOrders);

      await positionManager.settleFunds();

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

  await orderManager.cancelOpenOrders();

  console.log(`MARKET MAKER EXITED`);

})();
