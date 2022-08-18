import { MarginAccount } from '../marginAccount';

export class SolanaMarginAccount extends MarginAccount {
  constructor(
    cluster: string,
    verbose: boolean,
    keyfile?: string,
    symbols?: string[],
  ) {
    super(cluster, verbose, keyfile, symbols);
  }

  static async createMarginAccount(
    cluster: string,
    keyfile: string,
  ): Promise<void> {
    const marginAccount = new SolanaMarginAccount(cluster, true, keyfile);
    await marginAccount.load();
    await marginAccount.createTokenAccounts();
    await marginAccount.createOpenOrders();
  }
}
