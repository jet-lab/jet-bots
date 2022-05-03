import { Connection } from '@solana/web3.js';

export class PositionManager {

  connection: Connection;

  constructor(
    connection: Connection,
  ) {
    this.connection = connection;
  }

  async getBaseTokenBalance()
  {
  }

  async getQuoteTokenBalance()
  {
  }

};
