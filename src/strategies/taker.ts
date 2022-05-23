import { Market, Orderbook } from "@project-serum/serum";
import { Order, OrderParams } from "@project-serum/serum/lib/market";
import { Account, Connection } from '@solana/web3.js';

import { Position } from '../position';
import { Strategy } from './strategy';

import PARAMS from '../params/taker.json';

export class Taker extends Strategy {

  constructor(
    connection: Connection,
    account: Account,
    positions: Position[],
    markets: Market[],
  ) {
    super(
      connection,
      account,
      positions,
      markets,
    );
  }

  async update(marketIndex: number, asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]> {
    let newOrders: OrderParams[] = [];
    let staleOrders: Order[] = [];

    //TODO

    /*
  public onAsk(book: SerumBook) {
    const thresh = 0.75; // aggressiveness
    const tbias = 0.0;
    const rshift = 0.5 + tbias;
    const rando = 2. * (Math.random() - rshift);

    // hit the midpt
    //if( rando > thresh) this.placeOrder('buy', +(book.basePrice), 1., 'ioc')
  }

  public onBid(book: SerumBook) {
    const thresh = 0.75; // aggressiveness
    const tbias = 0.0;
    const rshift = 0.5 + tbias;
    const rando = 2. * (Math.random() - rshift);

    // hit the midpt
    //if( rando > thresh) this.placeOrder('sell', +(book.basePrice), 1., 'ioc')
  }

  public onPrice(book: SerumBook, token: PythToken, price: PythPrice) {
    const thresh = 1 - 0.05;
    const tbias = 0.0;
    const rshift = 0.5 + tbias;
    const rando = 2. * (Math.random() - rshift);

    if (rando > thresh || rando < -thresh) {
      (async () => {
        if (rando > thresh) {
          const balance = await this.solanaClient.getBalance( this.wallet.publicKey);
          if (balance > book.ask[0][0]*book.ask[0][1]) await this.placeOrder('buy', book.ask[0][0], book.ask[0][1], 'ioc');
        } else if (rando < -thresh) {
          const balance = await this.solanaClient.getBalance( this.wallet.publicKey );
          if (this.position.currentPosition >= book.bid[0][1] || balance >= book.bid[0][0]*book.bid[0][1]) await this.placeOrder('sell', book.bid[0][0], book.bid[0][1], 'ioc');
        }
      })();
    }
  }
    */

    return [newOrders, staleOrders];
  }

}
