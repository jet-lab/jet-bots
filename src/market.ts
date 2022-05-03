import { Connection } from '@solana/web3.js';

export class Market {

  connection: Connection;

  constructor(
    connection: Connection,
  ) {
    this.connection = connection;
  }

  static async load(connection: Connection)
  {
  }

  async getAsks()
  {
  }

  async getBids()
  {
  }

};
