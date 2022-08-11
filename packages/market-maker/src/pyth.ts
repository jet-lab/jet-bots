import { parsePriceData, PriceData } from '@pythnetwork/client';
import {
  AccountInfo,
  Commitment,
  Connection,
  Context,
  PublicKey,
} from '@solana/web3.js';
import assert from 'assert';

export class PythOracle {
  oracleConfig: any;

  price?: PriceData;

  constructor(oracleConfig: any) {
    this.oracleConfig = oracleConfig;
  }

  async listen(connection: Connection): Promise<void> {
    connection.onAccountChange(
      new PublicKey(this.oracleConfig.address),
      (accountInfo: AccountInfo<Buffer>, context: Context) => {
        this.price = parsePriceData(accountInfo!.data);
      },
      'processed' as Commitment,
    );
  }

  static async load(
    connection: Connection,
    oracles: PythOracle[],
  ): Promise<void> {
    const accounts = await connection.getMultipleAccountsInfo(
      oracles.map(oracle => {
        assert(oracle.oracleConfig.address);
        return new PublicKey(oracle.oracleConfig.address);
      }),
    );
    for (let i = 0; i < oracles.length; i++) {
      if (accounts[i]) {
        oracles[i].price = parsePriceData(accounts[i]!.data);
      }
    }
  }
}
