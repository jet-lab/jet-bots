import assert from 'assert';

//TODO load this from a package.
import { MarginAccount } from '../../../bot-sdk/src/';

import { Bot } from './bot';

export class Crank extends Bot {
  constructor(marginAccount: MarginAccount) {
    super(marginAccount);

    assert(
      marginAccount.configuration.cluster == 'devnet' ||
        marginAccount.configuration.cluster == 'localnet',
    );
  }

  async process(): Promise<void> {
    await this.marginAccount!.crank();
  }
}
