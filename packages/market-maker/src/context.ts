import { OrderParams } from '@project-serum/serum/lib/market';
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
  bot?: Bot;
  config: any;
  marginAccount?: MarginAccount;

  connection: Connection;
  markets: Record<string, SerumMarket> = {};
  oracles: Record<string, PythOracle> = {};

  constructor(params: {
    botFactory?: BotFactory;
    cluster?: Cluster;
    marketDataContext?: Context;
  }) {
    if (params.cluster) {
      this.config = loadConfig(params.cluster);
      this.connection = new Connection(
        this.config.url,
        'processed' as Commitment,
      );
    } else {
      const argv: any = yargs(process.argv.slice(2)).options({
        /*
        a: { alias: 'account', required: true, type: 'string' },
        */
        b: { alias: 'bot', required: true, type: 'string' },
        c: { alias: 'cluster', required: true, type: 'string' },
        k: { alias: 'keyfile', required: true, type: 'string' },
      }).argv;
      this.config = loadConfig(argv.c);
      this.connection = new Connection(
        this.config.url,
        'processed' as Commitment,
      );
      const account = new Account(JSON.parse(fs.readFileSync(argv.k, 'utf-8')));
      /*
      this.marginAccount = new MarginAccount({
        address: new PublicKey(argv.a),
        connection: this.connection,
        owner: account,
        payer: account,
      });
      */
      if (params.marketDataContext) {
        this.bot = params.botFactory!(argv.b, this, params.marketDataContext);
      } else {
        this.bot = params.botFactory!(argv.b, this, this);
      }
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

  async load(): Promise<void> {
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
  }
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

export abstract class Bot {
  tradingContext: Context;
  marketDataContext: Context;

  constructor(tradingContext: Context, marketDataContext: Context) {
    this.tradingContext = tradingContext;
    this.marketDataContext = marketDataContext;
  }

  async close2(): Promise<void> {
    /*
    await context.bot.cancelOpenOrders();
    await context.bot.closeOpenOrdersAccounts();
    */
  }

  abstract process(): void;

  sendOrders(orders: any[]): void {
    if (this.tradingContext.marginAccount) {
      this.tradingContext.marginAccount.sendOrders(orders);
    }
  }
}
