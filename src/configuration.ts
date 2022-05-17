import { Account } from '@solana/web3.js';
import assert from 'assert';
import yargs from 'yargs/yargs';

import CONFIG from './config.json';

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
        assert(CONFIG.mainnet);
        return CONFIG.mainnet;
      }
    default:
      {
        throw new Error(`Invalid cluster: ${cluster}`);
      }
  }
}

function loadParams(params: string)
{
  return require(`./params/${params}.json`);
}

export class Configuration {

  account: Account;
  openOrdersAccount: Account;

  cancelOpenOrders: boolean;
  oracle: string;
  symbol: string;
  verbose: boolean;

  config: any;
  params: any;

  market: any;
  mainnetMarket: any;

  constructor(
    account: Account,
    openOrdersAccount: Account,
  ) {
    this.account = account;
    this.openOrdersAccount = openOrdersAccount;

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

    const markets = Object.keys(this.config.markets).map((key) => { return this.config.markets[key]; });
    this.market = markets.find((market) => { return market.symbol == this.symbol; })!;

    const mainnetMarkets = Object.keys(CONFIG.mainnet.markets).map((key) => { return CONFIG.mainnet.markets[key]; });
    this.mainnetMarket = mainnetMarkets.find((market) => { return market.symbol == this.symbol; })!;
  }

};
