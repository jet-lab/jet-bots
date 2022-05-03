import { Connection } from '@solana/web3.js';

export class Oracle {

  connection: Connection;

  constructor(
    connection: Connection,
  ) {
    this.connection = connection;
  }

  async getPrice()
  {
  }

};
