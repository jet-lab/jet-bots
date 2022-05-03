#!/usr/bin/env ts-node

import { Commitment, Connection } from '@solana/web3.js';

import { Controller } from './controller';
import { Market } from './market';
import { Oracle } from './oracle';
import { OrderManager } from './orderManager';
import { PositionManager } from './positionManager';
import { sleep } from './utils';

(async() => {

  const controller = new Controller();

  const connection = new Connection(controller.config.url, 'processed' as Commitment);

  const orderManager = new OrderManager(connection);
  controller.orderManager = orderManager;

  const market = Market.load(connection);

  const oracle = new Oracle(connection);

  const positionManager = new PositionManager(connection);

  if (controller.cancelOpenOrders) {
    await orderManager.cancelOpenOrders();
  }

  console.log(`MAKING A MARKET IN ${controller.symbol}`);

  while (controller.isRunning) {
    try {


      // Get the current base and quote token balances.


      // If the user doesn't have tokens do nothing.


      // Get the oracle price.


      // Get the open orders.


      // Update orders.


    } catch (e) {
      console.log(e);
    } finally {
      if (controller.verbose) {
        console.log(`${new Date().toUTCString()} sleeping for ${controller.interval / 1000}s`);
      }
      await sleep(controller.interval);
    }
  }

})();
