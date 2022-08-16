import { Cluster, Commitment, Connection } from '@solana/web3.js';
import assert from 'assert';
import yargs from 'yargs/yargs';

//TODO load this from a package.
import { Configuration, MarginAccount, Order } from '../../bot-sdk/src/';

import { PythOracle } from './pyth';
import { SerumMarket } from './serum';

export interface BotFactory {
  (type: string, tradingContext: Context, marketDataContext: Context): Bot;
}

export class Context {
  args: any;
  bot?: Bot;
  configuration: Configuration;
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
      assert(params.symbols);
      this.symbols = params.symbols;
      this.configuration = new Configuration(params.cluster, params.symbols);
      this.connection = new Connection(
        this.configuration.url,
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
      this.marginAccount = new MarginAccount(
        this.args.c,
        this.args.k,
        this.symbols,
      );
      this.configuration = this.marginAccount.configuration;
      this.connection = this.marginAccount.connection;
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

    for (const marketConfig of Object.values<any>(this.configuration.markets)) {
      const market = new SerumMarket(marketConfig);
      this.markets[marketConfig.symbol] = market;
    }
    await SerumMarket.load(
      this.connection,
      this.configuration.serumProgramId,
      Object.values<SerumMarket>(this.markets),
    );

    for (const oracleConfig of Object.values<any>(this.configuration.oracles)) {
      const oracle = new PythOracle(oracleConfig);
      this.oracles[oracleConfig.symbol] = oracle;
    }
    await PythOracle.load(
      this.connection,
      Object.values<PythOracle>(this.oracles),
    );

    if (params.botFactory) {
      //this.marginAccount!.printBalance();

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

  sendOrders(orders: Order[]): void {
    if (this.tradingContext.marginAccount) {
      this.tradingContext.marginAccount.sendOrders(orders);
    }
  }
}
