import { MarginAccount } from '../marginAccount';

export class ZeroOneMarginAccount extends MarginAccount {
  constructor(
    cluster: string,
    verbose: boolean,
    keyfile?: string,
    symbols?: string[],
  ) {
    super(cluster, verbose, keyfile, symbols);
  }
}
