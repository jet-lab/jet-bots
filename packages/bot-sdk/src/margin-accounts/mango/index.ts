import { MarginAccount } from '../marginAccount';

export class MangoMarginAccount extends MarginAccount {
  constructor(cluster: string, keyfile?: string, symbols?: string[]) {
    super(cluster, keyfile, symbols);
  }
}
