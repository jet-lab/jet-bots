import { Connection } from '@solana/web3.js';

export class OrderManager {

  connection: Connection;

  constructor(
    connection: Connection,
  ) {
    this.connection = connection;
  }

  async cancelOpenOrders()
  {
  }

};
