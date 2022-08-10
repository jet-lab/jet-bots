import { parsePriceData, PriceData } from '@pythnetwork/client';
import { BN } from '@project-serum/anchor';
import {
  DexInstructions,
  Market,
  OpenOrders,
  Orderbook,
} from '@project-serum/serum';
import {
  MARKET_STATE_LAYOUT_V2,
  Order,
  OrderParams,
} from '@project-serum/serum/lib/market';
import {
  Account,
  AccountInfo,
  Cluster,
  Commitment,
  Connection,
  Context as SolanaContext,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';
import yargs from 'yargs/yargs';

import { MarginAccount } from '../../trading-sdk/src/marginAccount';

//import { findOpenOrdersAccounts, getAssociatedTokenAddress } from './utils';

import CONFIG from './config.json';

export interface BotFactory {
  (type: string, tradingContext: Context, marketDataContext: Context): Bot;
}

export class Context {
  marginAccount?: MarginAccount;
  bot?: Bot;
  config: any;
  //oracle?: Oracle;

  connection: Connection;
  //TODO
  //feeDiscountPubkey: PublicKey | null;
  markets: Record<string, MarketContext> = {};
  oracles: Record<string, OracleContext> = {};
  //positions: Record<string, PositionContext> = {};
  //serumProgramId: PublicKey;

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

    //assert(this.config.serumProgramId);
    //this.serumProgramId = new PublicKey(this.config.serumProgramId);
  }

  async listen(): Promise<void> {
    if (this.marginAccount) {
      //await this.marginAccount.listen();
    }

    for (const market of Object.values<MarketContext>(this.markets)) {
      await market.listen();
    }

    for (const oracle of Object.values<OracleContext>(this.oracles)) {
      await oracle.listen();
    }
  }

  async load(): Promise<void> {
    if (this.marginAccount) {
      //await this.marginAccount.load();
    }

    for (const marketConfig of Object.values<any>(this.config.markets)) {
      const marketContext = new MarketContext(this, marketConfig);
      this.markets[marketConfig.symbol] = marketContext;
      await marketContext.load();
    }

    for (const oracleConfig of Object.values<any>(this.config.oracles)) {
      const oracleContext = new OracleContext(this, oracleConfig);
      this.oracles[oracleConfig.symbol] = oracleContext;
      await oracleContext.load();
    }

    /*
    for (const tokenConfig of Object.values<any>(this.config.tokens)) {
      const positionContext = new PositionContext(this, tokenConfig);
      this.positions[tokenConfig.symbol] = positionContext;
      //await positionContext.init();
      await positionContext.load();
    }
    */

    /*
    for (const marketConfig of Object.values<any>(config.markets)) {
      const [baseTokenAccount, quoteTokenAccount] = await Promise.all([
        await getAssociatedTokenAddress(
          new PublicKey(marketConfig.baseMint),
          account.publicKey,
        ),
        await getAssociatedTokenAddress(
          new PublicKey(marketConfig.quoteMint),
          account.publicKey,
        ),
      ]);

      const openOrdersAccount = await Position.getOrCreateOpenOrdersAccount(
        connection,
        market.address,
        account,
        serumProgramId,
      );
    }
    */
  }

  /*
import {
  getAssociatedTokenAddress,
  getSplTokenBalanceFromAccountInfo,
} from '../utils';
*/

  /*
  const msrmTokenAccounts = await connection.getTokenAccountsByOwner(account.publicKey, { mint: new PublicKey(config.tokens.MSRM.mint) });
  if (msrmTokenAccounts.value.length > 0) {
    feeDiscountPubkey = msrmTokenAccounts.value[0].pubkey;
  } else {
    const srmTokenAccounts = await connection.getTokenAccountsByOwner(account.publicKey, { mint: new PublicKey(config.tokens.SRM.mint) });
    if (srmTokenAccounts.value.length > 0) {
      let max = 0;
      srmTokenAccounts.value.forEach(({ pubkey, account }) => {
        const balance = getSplTokenBalanceFromAccountInfo(account, config.tokens.SRM.decimals);
        if (balance > max) {
          max = balance;
          feeDiscountPubkey = pubkey;
        }
      });
    }
  }
  */
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

  abstract process(): void;

  /*
  async cancelOpenOrders() {
    for (const market of Object.values<Market>(this.context.markets)) {
      const openOrders = await market.loadOrdersForOwner(
        this.context.connection,
        this.context.account!.publicKey,
      );
      for (const openOrder of openOrders) {
        await market.cancelOrder(this.context.connection, this.context.account!, openOrder);
      }
    }
  }

  async closeOpenOrdersAccounts() {
    for (const position of Object.values<Position>(this.context.positions)) {
      await position.closeOpenOrdersAccounts();
    }
  }

  //abstract update(symbol: string, asks: Orderbook, bids: Orderbook, openOrders: Order[]): Promise<[OrderParams[], Order[]]>;
  abstract update(
    symbol: string,
    asks: Orderbook,
    bids: Orderbook,
  ): Promise<[OrderParams[], Order[]]>;

  async updateOrders(
    market: Market,
    newOrders: OrderParams[],
    cancelOrders: Order[],
  ) {
    if (cancelOrders.length > 0) {
      for (const order of cancelOrders) {
        await market.cancelOrder(this.context.connection, this.context.account!, order);
      }
    }

    if (newOrders.length > 0) {
      for (const orderParams of newOrders) {
        await this.placeOrder(this.context.connection, market, orderParams);
      }
    }
  }

  async placeOrder(
    connection: Connection,
    market: Market,
    {
      owner,
      payer,
      side,
      price,
      size,
      orderType = 'limit',
      clientId,
      openOrdersAddressKey,
      openOrdersAccount,
      feeDiscountPubkey,
      maxTs,
      replaceIfExists = false,
    }: OrderParams,
  ) {
    assert(openOrdersAddressKey);

    const { transaction, signers } =
      await this.makePlaceOrderTransaction<Account>(market, {
        owner,
        payer,
        side,
        price,
        size,
        orderType,
        clientId,
        openOrdersAddressKey,
        openOrdersAccount,
        feeDiscountPubkey,
        maxTs,
        replaceIfExists,
      });
    return await sendAndConfirmTransaction(
      connection,
      transaction,
      [owner, ...signers],
      { skipPreflight: true, commitment: 'processed' },
    );
  }

  async makePlaceOrderTransaction<T extends PublicKey | Account>(
    market: Market,
    {
      owner,
      payer,
      side,
      price,
      size,
      orderType = 'limit',
      clientId,
      openOrdersAddressKey,
      openOrdersAccount,
      feeDiscountPubkey,
      selfTradeBehavior = 'decrementTake',
      maxTs,
      replaceIfExists = false,
    }: OrderParams<T>,
  ) {
    const transaction = new Transaction();
    const signers: Account[] = [];

    const placeOrderInstruction = this.makePlaceOrderInstruction(market, {
      owner,
      payer: payer,
      side,
      price,
      size,
      orderType,
      clientId,
      openOrdersAddressKey,
      feeDiscountPubkey,
      selfTradeBehavior,
      maxTs,
      replaceIfExists,
    });
    transaction.add(placeOrderInstruction);

    return { transaction, signers, payer: owner };
  }

  makePlaceOrderInstruction<T extends PublicKey | Account>(
    market: Market,
    params: OrderParams<T>,
  ): TransactionInstruction {
    const {
      owner,
      payer,
      side,
      price,
      size,
      orderType = 'limit',
      clientId,
      openOrdersAddressKey,
      openOrdersAccount,
      feeDiscountPubkey,
    } = params;
    if (market.baseSizeNumberToLots(size).lte(new BN(0))) {
      console.log(`size = ${size}`);
      console.log(
        `market.baseSizeNumberToLots(size) = ${market.baseSizeNumberToLots(
          size,
        )}`,
      );
      throw new Error('size too small');
    }
    if (market.priceNumberToLots(price).lte(new BN(0))) {
      console.log(`price = ${price}`);
      console.log(
        `market.priceNumberToLots(price) = ${market.priceNumberToLots(price)}`,
      );
      throw new Error('invalid price');
    }
    return market.makeNewOrderV3Instruction(params);
  }
  */
}

export class MarketContext {
  context: Context;
  marketConfig: any;

  market?: Market;

  constructor(context: Context, marketConfig: any) {
    this.context = context;
    this.marketConfig = marketConfig;
  }

  async listen(): Promise<void> {
    assert(this.marketConfig.market);
    this.context.connection.onAccountChange(
      new PublicKey(this.marketConfig.market),
      (accountInfo: AccountInfo<Buffer>, context: SolanaContext) => {
        assert(this.market);
        const m = this.market as any;
        this.market = new Market(
          MARKET_STATE_LAYOUT_V2.decode(accountInfo.data),
          m._baseMintDecimals,
          m._quoteMintDecimals,
          m._options,
          m._programId,
        );
      },
      'processed' as Commitment,
    );
  }

  async load(): Promise<void> {
    assert(this.context.config.serumProgramId);
    assert(this.marketConfig.market);
    this.market = await Market.load(
      this.context.connection,
      new PublicKey(this.marketConfig.market),
      { skipPreflight: true, commitment: 'processed' },
      new PublicKey(this.context.config.serumProgramId),
    );
  }
}

export class OracleContext {
  context: Context;
  oracleConfig: any;

  price?: PriceData;

  constructor(context: Context, oracleConfig: any) {
    this.context = context;
    this.oracleConfig = oracleConfig;
  }

  async listen(): Promise<void> {
    this.context.connection.onAccountChange(
      new PublicKey(this.oracleConfig.address),
      (accountInfo: AccountInfo<Buffer>, context: SolanaContext) => {
        this.price = parsePriceData(accountInfo!.data);
        //console.log(`${this.oracleConfig.symbol} price = ${this.price.price}`);
      },
      'processed' as Commitment,
    );
  }

  async load(): Promise<void> {
    assert(this.oracleConfig.address);
    const accountInfo = await this.context.connection.getAccountInfo(
      new PublicKey(this.oracleConfig.address),
    );
    this.price = parsePriceData(accountInfo!.data);
    //console.log(`${this.oracleConfig.symbol} price = ${this.price.price}`);
  }
}

export class PositionContext2 {
  context: Context;
  tokenConfig: any;

  //account: Account;
  //baseTokenAccount: PublicKey;
  //quoteTokenAccount: PublicKey;
  //market: Market;
  //openOrdersAccount: PublicKey;

  baseTokenBalance = 0;
  quoteTokenBalance = 0;

  constructor(
    context: Context,
    tokenConfig: any,
    //baseTokenAccount: PublicKey,
    //quoteTokenAccount: PublicKey,
    //market: Market,
    //openOrdersAccount: PublicKey,
  ) {
    this.context = context;
    this.tokenConfig = tokenConfig;
    //this.baseTokenAccount = baseTokenAccount;
    //this.quoteTokenAccount = quoteTokenAccount;
    //this.market = market;
    //this.openOrdersAccount = openOrdersAccount;
  }

  //TODO
  async load(): Promise<void> {
    //this.baseTokenBalance = (await this.getTokenBalance(this.baseTokenAccount))!;
    //this.quoteTokenBalance = (await this.getTokenBalance(this.quoteTokenAccount))!;
  }

  /*
  async init(): Promise<void> {
    const openOrdersAccountInfo = await this.connection.getAccountInfo(
      this.openOrdersAccount,
    );
    assert(openOrdersAccountInfo);
  }
  */

  async closeOpenOrdersAccounts() {
    /*
    console.log(
      `closeOpenOrdersAccounts ${this.context.marginAccount!.owner.publicKey}`,
    );
    */
    /*
    const openOrdersAccounts = await findOpenOrdersAccounts(
      this.connection,
      this.market.address,
      this.account.publicKey,
      this.market.programId,
    );

    const baseWallet = await getAssociatedTokenAddress(
      new PublicKey(this.market.baseMintAddress),
      this.account.publicKey,
    );
    const quoteWallet = await getAssociatedTokenAddress(
      new PublicKey(this.market.quoteMintAddress),
      this.account.publicKey,
    );

    // @ts-ignore
    const vaultSigner = await PublicKey.createProgramAddress(
      [
        this.market.address.toBuffer(),
        this.market.decoded.vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
      ],
      this.market.programId,
    );

    for (const openOrdersAccount of openOrdersAccounts) {
      //console.log(`openOrdersAccount = ${openOrdersAccount}`);
      const accountInfo = await this.connection.getAccountInfo(
        openOrdersAccount,
      );
      if (!accountInfo) continue;
      const openOrders = OpenOrders.fromAccountInfo(
        openOrdersAccount,
        accountInfo,
        this.market.programId,
      );
      let hasOrders = false;
      openOrders.orders.forEach(orderId => {
        if (!orderId.eq(new BN(0))) hasOrders = true;
      });
      if (hasOrders) continue;

      const transaction = new Transaction();

      if (
        Number(openOrders.baseTokenFree) > 0 ||
        Number(openOrders.quoteTokenFree) > 0
      ) {
        transaction.add(
          DexInstructions.settleFunds({
            market: this.market.address,
            openOrders: openOrdersAccount,
            owner: this.account.publicKey,
            baseVault: this.market.decoded.baseVault,
            quoteVault: this.market.decoded.quoteVault,
            baseWallet,
            quoteWallet,
            vaultSigner,
            programId: this.market.programId,
            referrerQuoteWallet: this.quoteTokenAccount,
          }),
        );
      }

      transaction.add(
        DexInstructions.closeOpenOrders({
          market: this.market.address,
          openOrders: openOrdersAccount,
          owner: this.account.publicKey,
          solWallet: this.account.publicKey,
          programId: this.market.programId,
        }),
      );

      await sendAndConfirmTransaction(this.connection, transaction, [
        this.account,
      ]);
    }
    */
  }

  async getBalance(publicKey: PublicKey) {
    return await this.context.connection.getBalance(publicKey, 'processed');
  }

  static async getOrCreateOpenOrdersAccount(
    connection: Connection,
    marketAddress: PublicKey,
    owner: Account,
    serumProgramId: PublicKey,
  ): Promise<PublicKey> {
    /*
    const openOrdersAccounts = await findOpenOrdersAccounts(
      connection,
      marketAddress,
      owner.publicKey,
      serumProgramId,
    );

    if (openOrdersAccounts.length > 0) {
      return openOrdersAccounts[0];
    }

    const openOrdersAccount = new Account();

    const transaction = new Transaction().add(
      await OpenOrders.makeCreateAccountTransaction(
        connection,
        marketAddress,
        owner.publicKey,
        openOrdersAccount.publicKey,
        serumProgramId,
      ),
      DexInstructions.initOpenOrders({
        market: marketAddress,
        openOrders: openOrdersAccount.publicKey,
        owner: owner.publicKey,
        programId: serumProgramId,
        marketAuthority: undefined,
      }),
    );

    await sendAndConfirmTransaction(
      connection,
      transaction,
      [owner, openOrdersAccount],
      { commitment: 'confirmed' },
    );

    return openOrdersAccount.publicKey;
    */
    throw new Error('Implement');
  }

  async getTokenBalance(tokenAddress: PublicKey) {
    const balance = await this.context.connection.getTokenAccountBalance(
      tokenAddress,
      'processed',
    );
    return balance.value.uiAmount;
  }

  /*
  async settleFunds() {
    // @ts-ignore
    const vaultSigner = await PublicKey.createProgramAddress(
      [
        this.market.address.toBuffer(),
        this.market.decoded.vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
      ],
      this.market.programId,
    );

    const transaction = new Transaction().add(
      DexInstructions.settleFunds({
        market: this.market.address,
        openOrders: this.openOrdersAccount,
        owner: this.account.publicKey,
        baseVault: this.market.decoded.baseVault,
        quoteVault: this.market.decoded.quoteVault,
        baseWallet: this.baseTokenAccount,
        quoteWallet: this.quoteTokenAccount,
        vaultSigner,
        programId: this.market.programId,
        referrerQuoteWallet: this.quoteTokenAccount,
      }),
    );
    await sendAndConfirmTransaction(this.connection, transaction, [
      this.account,
    ]);
  }
  */
}
