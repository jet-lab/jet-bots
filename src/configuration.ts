import { Account } from '@solana/web3.js';
import assert from 'assert';
import yargs from 'yargs/yargs';

import CONFIG from './config.json';

export class Configuration {

  cancelOpenOrders: boolean;
  oracle?: string;
  verbose: boolean;

  config: any;
  strategies: string[];

  market: any;
  mainnetMarket: any;

  constructor() {
    const argv: any = yargs(process.argv.slice(2)).options({
      c: { alias: 'cancel all open orders', default: true, type: 'boolean' },
      o: { alias: 'oracle', required: false, type: 'string' },
      s: { alias: 'strategies', required: true, type: 'string' },
      u: { alias: 'url', required: true, type: 'string' },
      v: { alias: 'verbose', default: false, type: 'boolean' },
    }).argv;

    this.cancelOpenOrders = argv.c;
    if (argv.o) this.oracle = argv.o;
    this.strategies = argv.s.split(',');
    this.config = loadConfig(argv.u);
    this.verbose = argv.v;
  }

};

export function loadConfig(cluster: string): any
{
  switch (cluster)
  {
    case 'd':
    case 'devnet':
      {
        assert(CONFIG.devnet);
        return CONFIG.devnet;
      }
    case 'l':
    case 'localnet':
      {
        assert(CONFIG.localnet);
        return CONFIG.localnet;
      }
    case 'm':
    case 'mainnet':
    case 'mainnet-beta':
      {
        assert(CONFIG['mainnet-beta']);
        return CONFIG['mainnet-beta'];
      }
    default:
      {
        throw new Error(`Invalid cluster: ${cluster}`);
      }
  }
}
