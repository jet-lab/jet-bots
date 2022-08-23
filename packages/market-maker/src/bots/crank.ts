import { Protocol } from '@jet-lab/bot-sdk';
import assert from 'assert';

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
