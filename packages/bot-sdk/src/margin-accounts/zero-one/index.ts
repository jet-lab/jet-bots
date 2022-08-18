import { MarginAccount } from '../marginAccount';

export class ZeroOneMarginAccount extends MarginAccount {
  constructor(cluster: string, keyfile?: string, symbols?: string[]) {
    super(cluster, keyfile, symbols);
  }
}
