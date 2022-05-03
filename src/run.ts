#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as os from 'os';
import { Account, Commitment, Connection, Keypair, PublicKey } from '@solana/web3.js';

import { Configuration } from './configuration';
import { Controller } from './controller';
import { Market } from './market';
import { Oracle } from './oracle';
import { OrderManager } from './orderManager';
import { PositionManager } from './positionManager';
import { sleep } from './utils';

(async() => {

  const account = new Account(
    JSON.parse(
      fs.readFileSync(
        process.env.KEYPAIR || os.homedir() + '/.config/solana/id.json',
        'utf-8',
      ),
    ),
  );

  const configuration = new Configuration(account);

  const controller = new Controller();

  const connection = new Connection(configuration.config.url, 'processed' as Commitment);

  const market = await Market.load(configuration, connection);

  const oracle = new Oracle(configuration, connection);

  const orderManager = new OrderManager(configuration, connection);
  controller.orderManager = orderManager;

  const positionManager = new PositionManager(configuration, connection);

  if (configuration.cancelOpenOrders) {
    await orderManager.cancelOpenOrders();
  }

  console.log(`MAKING A MARKET IN ${configuration.symbol}`);

  while (controller.isRunning) {
    try {

      await Promise.all([
        await positionManager.fetchPositions(),
        await oracle.fetchPrice(),
        await market.fetchAsks(),
        await market.fetchBids(),
        await orderManager.fetchOpenOrders(),
      ]);

      await orderManager.updateOrders(oracle);

    } catch (e) {
      console.log(e);
    } finally {
      if (configuration.verbose) {
        console.log(`${new Date().toUTCString()} sleeping for ${controller.interval / 1000}s`);
      }
      await sleep(controller.interval);
    }
  }

})();
