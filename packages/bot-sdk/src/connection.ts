import {
  Commitment,
  Connection as SolanaConnection,
  SendOptions,
  SignatureResult,
  Signer,
  Transaction,
} from '@solana/web3.js';

export class Connection extends SolanaConnection {
  verbose: boolean;

  constructor(endpoint: string, verbose: boolean) {
    super(endpoint, 'processed' as Commitment);
    this.verbose = verbose;
    console.log(`CONNECT: ${endpoint}`);
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

      const transactionResponse = await this.getTransaction(txid, { commitment: "confirmed" });
      console.log(JSON.stringify(transactionResponse?.meta?.logMessages, undefined, 2));
    }
    return value;
  }
}
