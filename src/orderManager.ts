import { Connection, PublicKey } from '@solana/web3.js';

import { Configuration } from './configuration';
import { Market } from './market';
import { Oracle } from './oracle';
import { PositionManager } from './positionManager';

export class OrderManager {

  configuration: Configuration;
  connection: Connection;

  constructor(
    configuration: Configuration,
    connection: Connection,
  ) {
    this.configuration = configuration;
    this.connection = connection;
  }

  async cancelOpenOrders()
  {

    const instructions: TransactionInstruction[] = [

      makeCancelAllPerpOrdersInstruction(
        mangoProgramId,
        group.publicKey,
        mangoAccount.publicKey,
        payer.publicKey,
        market.publicKey,
        market.bids,
        market.asks,
        new BN(20),
      ),

    ];

  }

  async fetchOpenOrders()
  {
    //const accountInfos = await getMultipleAccounts(connection, allAccounts);
  }

  async updateOrders(oracle: Oracle, positionManager: PositionManager, market: Market)
  {
    const fairValue: number = oracle.price?.price!;
    const halfSpread: number = fairValue * this.configuration.params.spreadBPS * 0.0001;

    const baseTokenBalance = positionManager.baseTokenBalance;
    const quoteTokenBalance = positionManager.quoteTokenBalance;

    const baseOpenOrdersBalance = market.baseOpenOrdersBalance;
    const quoteOpenOrdersBalance = market.quoteOpenOrdersBalance;

    const accountValue = ((baseTokenBalance + baseOpenOrdersBalance) * fairValue) + (quoteTokenBalance + quoteOpenOrdersBalance);

    const quoteSize = accountValue * this.configuration.params.sizePercent;

    const askPrice: number = fairValue + halfSpread;
    const bidPrice: number = fairValue - halfSpread;

    const instructions: TransactionInstruction[] = [

      makeCancelAllPerpOrdersInstruction(
        mangoProgramId,
        group.publicKey,
        mangoAccount.publicKey,
        payer.publicKey,
        market.publicKey,
        market.bids,
        market.asks,
        new BN(20),
      ),

      makePlacePerpOrder2Instruction(
        mangoProgramId,
        group.publicKey,
        mangoAccount.publicKey,
        payer.publicKey,
        cache.publicKey,
        market.publicKey,
        market.bids,
        market.asks,
        market.eventQueue,
        mangoAccount.getOpenOrdersKeysInBasketPacked(),
        bookAdjBid,
        nativeBidSize,
        I64_MAX_BN,
        new BN(Date.now()),
        'buy',
        new BN(20),
        'postOnlySlide',
        false,
        undefined,
        expiryTimestamp
      ),

      makePlacePerpOrder2Instruction(
        mangoProgramId,
        group.publicKey,
        mangoAccount.publicKey,
        payer.publicKey,
        cache.publicKey,
        market.publicKey,
        market.bids,
        market.asks,
        market.eventQueue,
        mangoAccount.getOpenOrdersKeysInBasketPacked(),
        bookAdjAsk,
        nativeAskSize,
        I64_MAX_BN,
        new BN(Date.now()),
        'sell',
        new BN(20),
        'postOnlySlide',
        false,
        undefined,
        expiryTimestamp
      ),

    ];

  }

};
