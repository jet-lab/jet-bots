import assert from 'assert';

//TODO load this from a package.
import { Protocol } from '../../../bot-sdk/src/';

import { Bot } from './bot';

export class Crank extends Bot {
  constructor(protocol: Protocol) {
    super(protocol);

    assert(
      protocol.configuration.cluster == 'devnet' ||
        protocol.configuration.cluster == 'localnet',
    );
  }

  async process(): Promise<void> {
    await this.protocol!.crank();
  }
}
