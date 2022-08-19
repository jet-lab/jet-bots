import { Protocol } from '../protocol';

export class MangoProtocol extends Protocol {
  constructor(
    cluster: string,
    verbose: boolean,
    keyfile?: string,
    symbols?: string[],
  ) {
    super(cluster, verbose, keyfile, symbols);
  }

  async closeAccount(): Promise<void> {
    throw new Error('Implement.');
  }
}
