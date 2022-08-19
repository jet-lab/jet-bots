import { createCloseAccountInstruction } from '@solana/spl-token';
import { Transaction } from '@solana/web3.js';
import assert from 'assert';

import { Position } from '../position';
import { Protocol } from '../protocol';

export class SolanaProtocol extends Protocol {
  constructor(
    cluster: string,
    verbose: boolean,
    keyfile?: string,
    symbols?: string[],
  ) {
    super(cluster, verbose, keyfile, symbols);
  }

  async closeAccount(): Promise<void> {
    assert(this.loaded);

    await this.cancelOrders();
    await this.settleFunds();
    await this.closeOpenOrders();

    const transaction = new Transaction();
    for (const position of Object.values<Position>(this.positions)) {
      if (position.tokenAccount && Number(position.balance) == 0) {
        transaction.add(
          createCloseAccountInstruction(
            position.tokenAccount,
            this.owner!.publicKey,
            this.owner!.publicKey,
          ),
        );
      }
    }
    if (transaction.instructions.length > 0) {
      await this.connection.sendAndConfirmTransaction(transaction, [
        this.owner!,
      ]);
    }

    //TODO close the margin account, transfer the tokens back to the user wallet.

    this.loaded = false;
  }

  static async createAccount(cluster: string, keyfile: string): Promise<void> {
    const protocol = new SolanaProtocol(cluster, true, keyfile);
    await protocol.load();
    await protocol.createTokenAccounts();
    await protocol.createOpenOrders();
  }
}
