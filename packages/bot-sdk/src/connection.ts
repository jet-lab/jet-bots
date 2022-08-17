import {
  Commitment,
  Connection as SolanaConnection,
  ConnectionConfig,
  SendOptions,
  Signer,
  Transaction,
} from '@solana/web3.js';

export class Connection extends SolanaConnection {
  constructor(
    endpoint: string,
    commitmentOrConfig?: Commitment | ConnectionConfig,
  ) {
    super(endpoint, commitmentOrConfig);
  }

  async sendAndConfirmTransaction(
    transaction: Transaction,
    signers: Signer[],
    options: SendOptions = { skipPreflight: true },
    commitment: Commitment = 'processed',
  ): Promise<string> {
    const txid = await this.sendTransaction(transaction, signers, options);
    console.log(txid);
    const { value } = await this.confirmTransaction(txid, commitment);
    if (value?.err) {
      console.log(`ERROR: ${JSON.stringify(value.err)}`);
    }
    return txid;
  }
}
