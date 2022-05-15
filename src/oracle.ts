import { parsePriceData, PriceData } from '@pythnetwork/client'
import { Connection, PublicKey } from '@solana/web3.js';
import assert from 'assert';

import { Configuration } from './configuration';

export class Oracle {

  configuration: Configuration;
  mainnetConfig: any;

  connection: Connection;

  address: PublicKey;

  price: PriceData | undefined;

  pythProgramId: PublicKey;

  constructor(
    configuration: Configuration,
    mainnetConfig: any,
    connection: Connection,
  ) {
    this.configuration = configuration;
    this.mainnetConfig = mainnetConfig;
    this.connection = connection;

    const oracles = Object.keys(mainnetConfig.oracles).map((key) => { return mainnetConfig.oracles[key]; });

    const oracle = oracles.find((oracle) => { return oracle.symbol == configuration.symbol.substring(0, configuration.symbol.length - 1); })!;

    this.address = new PublicKey(oracle.address);

    assert(mainnetConfig.pythProgramId);
    this.pythProgramId = new PublicKey(mainnetConfig.pythProgramId);
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
