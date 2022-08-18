import { DexInstructions } from '@project-serum/serum';
import { decodeEventQueue } from '@project-serum/serum/lib/queue';
import { PublicKey, Transaction } from '@solana/web3.js';
import assert from 'assert';
import { BN } from 'bn.js';

//TODO load this from a package.
import { SerumMarket } from '../../../bot-sdk/src/';

import { Bot, Context } from '../context';

export class Crank extends Bot {
  consumeEventsLimit = 10;

  constructor(tradingContext: Context, marketDataContext: Context) {
    super(tradingContext, marketDataContext);

    assert(
      tradingContext.configuration.cluster == 'devnet' ||
        tradingContext.configuration.cluster == 'localnet',
    );
  }

  process(): void {
    const transaction = new Transaction();
    for (const market of Object.values<SerumMarket>(
      this.tradingContext.markets,
    )) {
      const basePosition =
        this.tradingContext.marginAccount!.markets[
          market.marketConfiguration.symbol
        ].basePosition;
      const quotePosition =
        this.tradingContext.marginAccount!.markets[
          market.marketConfiguration.symbol
        ].quotePosition;
      if (basePosition.tokenAccount && quotePosition.tokenAccount) {
        if (market.hasEvents) {
          assert(market.eventsAccountInfo);
          const events = decodeEventQueue(market.eventsAccountInfo);
          if (events.length > 0) {
            const accounts: Set<PublicKey> = new Set();
            for (const event of events) {
              accounts.add(event.openOrders);
              if (accounts.size >= this.consumeEventsLimit) break;
              const openOrdersAccounts = [...accounts]
                .map(s => new PublicKey(s))
                .sort((a, b) =>
                  a.toBuffer().swap64().compare(b.toBuffer().swap64()),
                );
              transaction.add(
                DexInstructions.consumeEvents({
                  market: market.market!.address,
                  eventQueue: market.marketConfiguration.eventQueue,
                  coinFee: basePosition.tokenAccount,
                  pcFee: quotePosition.tokenAccount,
                  openOrdersAccounts,
                  limit: new BN(this.consumeEventsLimit),
                  programId: this.tradingContext.configuration.serumProgramId,
                }),
              );
            }
          }
          market.hasEvents = false;
        }
      }
    }

    if (transaction.instructions.length > 0) {
      transaction.feePayer =
        this.tradingContext.marginAccount!.payer!.publicKey;

      //TODO
      //await this.connection.sendTransaction(transaction, [payer]);
    }
  }
}
