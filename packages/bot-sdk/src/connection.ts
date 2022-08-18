import {
  Commitment,
  Connection as SolanaConnection,
  ConnectionConfig,
  SendOptions,
  SignatureResult,
  Signer,
  Transaction,
} from '@solana/web3.js';

export class Connection extends SolanaConnection {
  verbose: boolean;

  constructor(
    endpoint: string,
    commitmentOrConfig: Commitment | ConnectionConfig,
    verbose: boolean,
  ) {
    super(endpoint, commitmentOrConfig);
    this.verbose = verbose;
  }

  async sendAndConfirmTransaction(
    transaction: Transaction,
    signers: Signer[],
    options: SendOptions = { skipPreflight: true },
    commitment: Commitment = 'processed',
  ): Promise<SignatureResult> {
    const txid = await this.sendTransaction(transaction, signers, options);
    if (this.verbose) {
      console.log(txid);
    }
    const { value } = await this.confirmTransaction(txid, commitment);
    if (value?.err) {
      console.log(`ERROR: ${JSON.stringify(value.err)}`);
    }
    return value;
  }
}
