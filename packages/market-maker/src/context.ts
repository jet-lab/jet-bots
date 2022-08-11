import {
  Account,
  Cluster,
  Commitment,
  Connection,
  PublicKey,
} from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';
import yargs from 'yargs/yargs';

import { MarginAccount } from '../../trading-sdk/src/marginAccount';

import { PythOracle } from './pyth';
import { SerumMarket } from './serum';

import CONFIG from './config.json';

export interface BotFactory {
  (type: string, tradingContext: Context, marketDataContext: Context): Bot;
}

export class Context {
  args: any;
  bot?: Bot;
  config: any;
  marginAccount?: MarginAccount;
  symbols: string[] = [];

  connection: Connection;
  markets: Record<string, SerumMarket> = {};
  oracles: Record<string, PythOracle> = {};

  constructor(
    params: {
      cluster?: Cluster;
      symbols?: string[];
    } = {},
  ) {
    if (params.cluster) {
      this.symbols = params.symbols!;
      assert(this.symbols);
      this.config = filterConfig(loadConfig(params.cluster), this.symbols);
      this.connection = new Connection(
        this.config.url,
        'processed' as Commitment,
      );
    } else {
      this.args = yargs(process.argv.slice(2)).options({
        b: { alias: 'bot', required: true, type: 'string' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
        s: { alias: 'symbols', required: true, type: 'string' },
      }).argv;
      this.symbols = this.args.s.split(',');
      assert(this.symbols);
      this.config = filterConfig(loadConfig(this.args.c), this.symbols);
      this.connection = new Connection(
        this.config.url,
        'processed' as Commitment,
      );
      const account = new Account(
        JSON.parse(fs.readFileSync(this.args.k, 'utf-8')),
      );
      this.marginAccount = new MarginAccount({
        connection: this.connection,
        owner: account,
        payer: account,
      });
    }
  }

  async listen(): Promise<void> {
    if (this.marginAccount) {
      await this.marginAccount.listen();
    }

    for (const market of Object.values<SerumMarket>(this.markets)) {
      await market.listen(this.connection);
    }

    for (const oracle of Object.values<PythOracle>(this.oracles)) {
      await oracle.listen(this.connection);
    }
  }

  async load(
    params: { botFactory?: BotFactory; marketDataContext?: Context } = {},
  ): Promise<void> {
    if (this.marginAccount) {
      await this.marginAccount.load();
    }

    for (const marketConfig of Object.values<any>(this.config.markets)) {
      const market = new SerumMarket(marketConfig);
      this.markets[marketConfig.symbol] = market;
    }
    assert(this.config.serumProgramId);
    await SerumMarket.load(
      this.connection,
      new PublicKey(this.config.serumProgramId),
      Object.values<SerumMarket>(this.markets),
    );

    for (const oracleConfig of Object.values<any>(this.config.oracles)) {
      const oracle = new PythOracle(oracleConfig);
      this.oracles[oracleConfig.symbol] = oracle;
    }
    await PythOracle.load(
      this.connection,
      Object.values<PythOracle>(this.oracles),
    );

    if (params.botFactory) {
      assert(this.args.b);
      assert(params.marketDataContext);
      if (params.marketDataContext) {
        this.bot = params.botFactory!(
          this.args.b,
          this,
          params.marketDataContext,
        );
      } else {
        this.bot = params.botFactory!(this.args.b, this, this);
      }
    }
  }
}

export abstract class Bot {
  tradingContext: Context;
  marketDataContext: Context;

  constructor(tradingContext: Context, marketDataContext: Context) {
    this.tradingContext = tradingContext;
    this.marketDataContext = marketDataContext;
  }

  abstract process(): void;

  sendOrders(orders: any[]): void {
    if (this.tradingContext.marginAccount) {
      this.tradingContext.marginAccount.sendOrders(orders);
    }
  }
}

function filterConfig(config: any, symbols: string[]) {
  const filteredConfig = { ...config, oracles: {}, markets: {} };
  Object.values<any>(config.markets)
    .filter(market => {
      return symbols.includes(market.symbol);
    })
    .forEach(market => {
      filteredConfig.markets[market.symbol.replace('/', '_')] = market;
    });
  Object.values<any>(config.oracles)
    .filter(oracle => {
      //TODO this isn't the best way to do this.
      return (
        oracle.symbol == 'USDC/USD' ||
        symbols.includes(oracle.symbol + 'C') ||
        symbols.includes(oracle.symbol + 'T')
      );
    })
    .forEach(oracle => {
      filteredConfig.oracles[oracle.symbol.replace('/', '_')] = oracle;
    });
  return filteredConfig;
}

function loadConfig(cluster: string): any {
  switch (cluster) {
    case 'd':
    case 'devnet': {
      assert(CONFIG.devnet);
      return CONFIG.devnet;
    }
    case 'l':
    case 'localnet': {
      assert(CONFIG.localnet);
      return CONFIG.localnet;
    }
    case 'm':
    case 'mainnet':
    case 'mainnet-beta': {
      assert(CONFIG['mainnet-beta']);
      return CONFIG['mainnet-beta'];
    }
    default: {
      throw new Error(`Invalid cluster: ${cluster}`);
    }
  }
}
