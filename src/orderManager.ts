import { Connection, PublicKey } from '@solana/web3.js';

import { Configuration } from './configuration';
import { Oracle } from './oracle';

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
    /*
  let tx = new Transaction();
  const txProms: any[] = [];
  for (let i = 0; i < marketContexts.length; i++) {
    const mc = marketContexts[i];
    const cancelAllInstr = makeCancelAllPerpOrdersInstruction(
      mangoProgramId,
      group.publicKey,
      mangoAccount.publicKey,
      payer.publicKey,
      mc.market.publicKey,
      mc.market.bids,
      mc.market.asks,
      new BN(20),
    );
    tx.add(cancelAllInstr);
    if (tx.instructions.length === params.batch) {
      txProms.push(client.sendTransaction(tx, payer, []));
      tx = new Transaction();
    }
  }

  if (tx.instructions.length) {
    txProms.push(client.sendTransaction(tx, payer, []));
  }
  const txids = await Promise.all(txProms);
  txids.forEach((txid) => {
    console.log(`cancel successful: ${txid.toString()}`);
  });
    */
  }

  async fetchOpenOrders()
  {
    //const accountInfos = await getMultipleAccounts(connection, allAccounts);
  }

  async updateOrders(oracle: Oracle)
  {
    //TODO add up positions and open orders to get token balances.

    //const quoteSize = equity * sizePerc;

    //oracle.price;

    //const fairValue = (aggBid + aggAsk) / 2;

    /*
  const leanCoeff = marketContext.params.leanCoeff;
  const charge = (marketContext.params.charge || 0.0015) + aggSpread / 2;
  const bias = marketContext.params.bias;
  const requoteThresh = marketContext.params.requoteThresh;
  const takeSpammers = marketContext.params.takeSpammers;
  const spammerCharge = marketContext.params.spammerCharge;
  const pfQuoteLeanCoeff = params.pfQuoteLeanCoeff || 0.001; // how much to move if pf pos is equal to equity
  const size = quoteSize / fairValue;
  const lean = (-leanCoeff * basePos) / size;
  const pfQuoteLean = (pfQuoteValue / equity) * -pfQuoteLeanCoeff;
  const bidPrice = fairValue * (1 - charge + lean + bias + pfQuoteLean);
  const askPrice = fairValue * (1 + charge + lean + bias + pfQuoteLean);
  // TODO volatility adjustment

  const [modelBidPrice, nativeBidSize] = market.uiToNativePriceQuantity(
    bidPrice,
    size,
  );
  const [modelAskPrice, nativeAskSize] = market.uiToNativePriceQuantity(
    askPrice,
    size,
  );

  const bestBid = bids.getBest();
  const bestAsk = asks.getBest();
  const bookAdjBid =
    bestAsk !== undefined
      ? BN.min(bestAsk.priceLots.sub(ONE_BN), modelBidPrice)
      : modelBidPrice;
  const bookAdjAsk =
    bestBid !== undefined
      ? BN.max(bestBid.priceLots.add(ONE_BN), modelAskPrice)
      : modelAskPrice;

  // TODO use order book to requote if size has changed

  let moveOrders = false;
  if (marketContext.lastBookUpdate >= marketContext.lastOrderUpdate + 2) {
    // if mango book was updated recently, then MangoAccount was also updated
    const openOrders = mangoAccount
      .getPerpOpenOrders()
      .filter((o) => o.marketIndex === marketIndex);
    moveOrders = openOrders.length < 2 || openOrders.length > 2;
    for (const o of openOrders) {
      const refPrice = o.side === 'buy' ? bookAdjBid : bookAdjAsk;
      moveOrders =
        moveOrders ||
        Math.abs(o.price.toNumber() / refPrice.toNumber() - 1) > requoteThresh;
    }
  } else {
    // If order was updated before MangoAccount, then assume that sent order already executed
    moveOrders =
      moveOrders ||
      Math.abs(marketContext.sentBidPrice / bookAdjBid.toNumber() - 1) >
        requoteThresh ||
      Math.abs(marketContext.sentAskPrice / bookAdjAsk.toNumber() - 1) >
        requoteThresh;
  }

  // Start building the transaction
  const instructions: TransactionInstruction[] = [
    makeCheckAndSetSequenceNumberInstruction(
      marketContext.sequenceAccount,
      payer.publicKey,
      Math.round(getUnixTs() * 1000),
    ),
  ];

  //
  // Clear 1 lot size orders at the top of book that bad people use to manipulate the price
  //
  if (
    takeSpammers &&
    bestBid !== undefined &&
    bestBid.sizeLots.eq(ONE_BN) &&
    bestBid.priceLots.toNumber() / modelAskPrice.toNumber() - 1 >
      spammerCharge * charge + 0.0005
  ) {
    console.log(`${marketContext.marketName} taking best bid spammer`);
    const takerSell = makePlacePerpOrder2Instruction(
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
      bestBid.priceLots,
      ONE_BN,
      I64_MAX_BN,
      new BN(Date.now()),
      'sell',
      new BN(20),
      'ioc',
    );
    instructions.push(takerSell);
  } else if (
    takeSpammers &&
    bestAsk !== undefined &&
    bestAsk.sizeLots.eq(ONE_BN) &&
    modelBidPrice.toNumber() / bestAsk.priceLots.toNumber() - 1 >
      spammerCharge * charge + 0.0005
  ) {
    console.log(`${marketContext.marketName} taking best ask spammer`);
    const takerBuy = makePlacePerpOrder2Instruction(
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
      bestAsk.priceLots,
      ONE_BN,
      I64_MAX_BN,
      new BN(Date.now()),
      'buy',
      new BN(20),
      'ioc',
    );
    instructions.push(takerBuy);
  }
  if (moveOrders) {
    // cancel all, requote
    const cancelAllInstr = makeCancelAllPerpOrdersInstruction(
      mangoProgramId,
      group.publicKey,
      mangoAccount.publicKey,
      payer.publicKey,
      market.publicKey,
      market.bids,
      market.asks,
      new BN(20),
    );

    const expiryTimestamp =
      params.tif !== undefined
        ? new BN((Date.now() / 1000) + params.tif)
        : new BN(0);

    const placeBidInstr = makePlacePerpOrder2Instruction(
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
    );

    const placeAskInstr = makePlacePerpOrder2Instruction(
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
    );
    instructions.push(cancelAllInstr);
    const posAsTradeSizes = basePos / size;
    if (posAsTradeSizes < 15) {
      instructions.push(placeBidInstr);
    }
    if (posAsTradeSizes > -15) {
      instructions.push(placeAskInstr);
    }
    console.log(
      `${marketContext.marketName} Requoting sentBidPx: ${
        marketContext.sentBidPrice
      } newBidPx: ${bookAdjBid} sentAskPx: ${
        marketContext.sentAskPrice
      } newAskPx: ${bookAdjAsk} pfLean: ${(pfQuoteLean * 10000).toFixed(
        1,
      )} aggBid: ${aggBid} addAsk: ${aggAsk}`,
    );
    marketContext.sentBidPrice = bookAdjBid.toNumber();
    marketContext.sentAskPrice = bookAdjAsk.toNumber();
    marketContext.lastOrderUpdate = getUnixTs();
  } else {
    // console.log(
    //   `${marketContext.marketName} Not requoting. No need to move orders`,
    // );
  }

  // if instruction is only the sequence enforcement, then just send empty
  if (instructions.length === 1) {
    return [];
  } else {
    return instructions;
  }
    */
  }

};
