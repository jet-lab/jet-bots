import yargs from 'yargs/yargs';
import { Account } from '@solana/web3.js';

import CONFIG from './config.json';

function loadConfig(cluster: string)
{
  switch (cluster)
  {
    case 'd':
    case 'devnet':
      {
        return CONFIG.devnet;
      }
    case 'l':
    case 'localhost':
      {
        return CONFIG.localnet;
      }
    case 'm':
    case 'mainnet':
    case 'mainnet-beta':
      {
        return CONFIG['mainnet-beta'];
      }
    default:
      {
        throw new Error(`Invalid cluster: ${cluster}`);
      }
  }
}

function loadParams(params: string)
{
  switch (params)
  {
    case 'fixed-spread':
      {
        return require('./params/fixed-spread.json');
      }
    default:
      {
        throw new Error(`Invalid params: ${params}`);
      }
  }
}

export class Configuration {

  account: Account;

  cancelOpenOrders: boolean;
  oracle: string;
  symbol: string;
  verbose: boolean;

  config: any;
  params: any;

  constructor(
    account: Account,
  ) {
    this.account = account;

    const argv: any = yargs(process.argv.slice(2)).options({
      c: { alias: 'cancel all open orders', default: true, type: 'boolean' },
      o: { alias: 'oracle', required: true, type: 'string' },
      p: { alias: 'params', required: true, type: 'string' },
      s: { alias: 'symbol', required: true, type: 'string' },
      u: { alias: 'url', required: true, type: 'string' },
      v: { alias: 'verbose', default: false, type: 'boolean' },
    }).argv;

    this.cancelOpenOrders = argv.c;
    this.oracle = argv.o;
    this.params = loadParams(argv.p);
    this.symbol = argv.s;
    this.config = loadConfig(argv.u);
    this.verbose = argv.v;
  }

};
