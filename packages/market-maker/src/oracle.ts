import { parsePriceData, PriceData } from '@pythnetwork/client'
import { Connection, PublicKey } from '@solana/web3.js';

export class Oracle {

  config: any;
  connection: Connection;
  address: PublicKey;
  pythProgramId: PublicKey;

  price: PriceData | undefined;

  constructor(
    config: any,
    connection: Connection,
    address: PublicKey,
    pythProgramId: PublicKey,
  ) {
    this.config = config;
    this.connection = connection;
    this.address = address;
    this.pythProgramId = pythProgramId;
  }

  async fetchPrice(): Promise<void> {
    const accountInfo = await this.connection.getAccountInfo(this.address);
    this.price = parsePriceData(accountInfo!.data)
  }

};
