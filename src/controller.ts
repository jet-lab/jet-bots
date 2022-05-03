import yargs from 'yargs/yargs';

import CONFIGURATION from './configuration.json';

import { OrderManager } from './orderManager';

function loadConfig(url: string)
{
  switch (url)
  {
    case 'd':
    case 'devnet':
      {
        return CONFIGURATION.devnet;
      }
    case 'l':
    case 'localhost':
      {
        return CONFIGURATION.localnet;
      }
    default:
      {
        throw new Error(`Invalid url: ${url}`);
      }
  }
}

export class Controller {

  isRunning = true;
  interval = 1000;

  cancelOpenOrders: boolean;
  oracle: string;
  symbol: string;
  verbose: boolean;

  config: any;

  orderManager: OrderManager | undefined;

  constructor(
  ) {
    const argv: any = yargs(process.argv.slice(2)).options({
      c: { alias: 'cancel all open orders', default: true, type: 'boolean' },
      o: { alias: 'oracle', required: true, type: 'string' },
      s: { alias: 'symbol', required: true, type: 'string' },
      u: { alias: 'url', required: true, type: 'string' },
      v: { alias: 'verbose', default: false, type: 'boolean' },
    }).argv;

    this.cancelOpenOrders = argv.c;
    this.oracle = argv.o;
    this.symbol = argv.s;
    this.config = loadConfig(argv.u);
    this.verbose = argv.v;

    process.on('SIGINT', () => {
      console.log('Caught keyboard interrupt. Canceling orders');
      this.isRunning = false;

      if (this.orderManager) {
        this.orderManager.cancelOpenOrders();
      }

      //onExit(client, payer, mangoGroup, mangoAccount, marketContexts);

      //process.exit();
    });

    process.on('unhandledRejection', (err, promise) => {
      console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
    });
  }

};
