import { MarginAccount } from '../marginAccount';

export class SolanaMarginAccount extends MarginAccount {
  constructor(cluster: string, keyfile?: string, symbols?: string[]) {
    super(cluster, keyfile, symbols);
  }

  static async createMarginAccount(
    cluster: string,
    keyfile: string,
  ): Promise<void> {
    const marginAccount = new SolanaMarginAccount(cluster, keyfile);
    await marginAccount.load();
    await marginAccount.createTokenAccounts();
    await marginAccount.createOpenOrders();
  }
}
