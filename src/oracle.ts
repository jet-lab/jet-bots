import { Connection, PublicKey } from '@solana/web3.js';

import { Configuration } from './configuration';

export class Oracle {

  configuration: Configuration;
  connection: Connection;

  address: PublicKey;

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
    //const accountInfos = await getMultipleAccounts(connection, allAccounts);

    /*
  public static async query(connection: Connection, pythProgram: PublicKey) {
    const programAccounts = await connection.getProgramAccounts(pythProgram, 'processed');
    return await Promise.all(
      programAccounts.map(account => {
        const base = parseBaseData(account.account.data);
        if (base != null) {
          if (AccountType[base.type] == 'Product') {
            const product = parseProductData(account.account.data)
            return {
              productAddress: account.pubkey.toBase58(),
              priceAddress: new PublicKey(product.priceAccountKey).toBase58(),
              ...product.product,
            };
          } else {
            return undefined;
          }
        }
      }).filter(product => { return product !== undefined; })
    );
  }
    */
  }

};
