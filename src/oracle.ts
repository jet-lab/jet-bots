import { parsePriceData, PriceData } from '@pythnetwork/client'
import { Connection, PublicKey } from '@solana/web3.js';

import { Configuration } from './configuration';

export class Oracle {

  configuration: Configuration;
  connection: Connection;

  address: PublicKey;

  price: PriceData | undefined;

  pythProgramId: PublicKey;

  constructor(
    configuration: Configuration,
    connection: Connection,
  ) {
    this.configuration = configuration;
    this.connection = connection;

    const oracle = configuration.config.oracles.find((oracle) => { return oracle.symbol == configuration.symbol.substring(0, configuration.symbol.length - 1); })!;

    this.address = new PublicKey(oracle.address);

    this.pythProgramId = new PublicKey(configuration.config.pythProgramId);
  }

  async fetchPrice()
  {
    const accountInfo = await this.connection.getAccountInfo(this.address);
    this.price = parsePriceData(accountInfo!.data)
    if (this.configuration.verbose) {
      console.log(`Oracle price = ${this.price.price}`);
    }
  }

};
