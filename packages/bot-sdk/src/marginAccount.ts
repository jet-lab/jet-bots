import { BN } from '@project-serum/anchor';
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Account,
  AccountInfo,
  Commitment,
  Connection,
  Context,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';

import {
  Configuration,
  MarketConfiguration,
  TokenConfiguration,
} from './configuration';
import { Market, Order } from './market';
import { Position } from './position';

export class MarginAccount {
  //address: PublicKey;
  configuration: Configuration;
  connection: Connection;
  //delegate?: Account;
  owner?: Account;
  payer: Account;
  serumProgramId: PublicKey;
  symbols?: string[];

  // Populated after load.
  loaded: boolean = false;
  markets: Record<string, Market> = {};
  payerBalance: number = 0;
  positions: Record<string, Position> = {};

  // Populated after listen.
  listening: boolean = false;

  constructor(cluster: string, keyfile: string, symbols?: string[]) {
    const configuration = new Configuration(cluster, symbols);
    const connection = new Connection(
      configuration.url,
      'processed' as Commitment,
    );
    const account = new Account(JSON.parse(fs.readFileSync(keyfile, 'utf-8')));

    //this.address = address;
    this.configuration = configuration;
    this.connection = connection;
    //this.delegate = delegate;
    this.owner = account;
    this.payer = account;
    this.serumProgramId = this.configuration.serumProgramId;
    this.symbols = symbols;
  }

  static async createMarginAccount(
    cluster: string,
    keyfile: string,
  ): Promise<void> {
    //TODO

    // Create token accounts.

    //await this.createOpenOrders();

    throw new Error('Implement.');
  }

  async load(): Promise<void> {
    assert(!this.loaded);

    this.payerBalance = await this.connection.getBalance(this.payer.publicKey);

    const response = await this.connection.getTokenAccountsByOwner(
      this.owner!.publicKey, //TODO replace account with a trading account, this.address,
      {
        programId: TOKEN_PROGRAM_ID,
      },
    );
    for (const item of response.value) {
      const tokenAccount = AccountLayout.decode(Buffer.from(item.account.data));
      const tokenConfig = Object.values<TokenConfiguration>(
        this.configuration.tokens,
      ).find(tokenConfig => {
        return tokenConfig.mint.toBase58() == tokenAccount.mint.toBase58();
      });
      if (tokenConfig) {
        assert(tokenConfig.mint.toBase58() == tokenAccount.mint.toBase58());
        this.positions[tokenConfig.symbol] = new Position(
          tokenConfig,
          item.pubkey,
          tokenAccount.amount,
        );
      }
    }

    for (const tokenConfig of Object.values<TokenConfiguration>(
      this.configuration.tokens,
    )) {
      if (!this.positions[tokenConfig.symbol]) {
        this.positions[tokenConfig.symbol] = new Position(tokenConfig);
      }
    }

    for (const marketConfig of Object.values<MarketConfiguration>(
      this.configuration.markets,
    )) {
      const market = new Market(marketConfig, this.positions);
      this.markets[marketConfig.symbol] = market;
    }
    await Market.load(
      this.connection,
      this.owner!.publicKey,
      this.serumProgramId,
      Object.values<Market>(this.markets),
    );

    this.loaded = true;
  }

  async listen(): Promise<void> {
    assert(this.loaded);
    assert(!this.listening);

    this.connection.onAccountChange(
      this.payer.publicKey,
      (accountInfo: AccountInfo<Buffer>, context: Context) => {
        this.payerBalance = accountInfo.lamports;
      },
      'confirmed' as Commitment,
    );

    for (const position of Object.values<Position>(this.positions)) {
      if (position.tokenAccount) {
        await position.listen(this.connection);
      }
    }

    await this.listenOpenOrders();

    this.listening = true;
  }

  async airdrop(symbol: string, amount: number): Promise<void> {
    assert(this.loaded);

    const tokenConfig = Object.values<TokenConfiguration>(
      this.configuration.tokens,
    ).find(tokenConfig => {
      return tokenConfig.symbol == symbol;
    });
    assert(tokenConfig);

    if (!this.positions[symbol]) {
      const position = await Position.create(
        this.connection,
        this.owner!.publicKey,
        this.payer,
        tokenConfig,
      );

      this.positions[symbol] = position;

      if (this.listening) {
        await position.listen(this.connection);
      }
    }

    assert(this.positions[symbol]);
    const position = this.positions[symbol];

    assert(this.configuration.splTokenFaucet);
    assert(tokenConfig.faucet);

    await airdropTokens(
      this.connection,
      this.configuration.splTokenFaucet,
      // @ts-ignore
      this.payer,
      new PublicKey(tokenConfig.faucet),
      position.tokenAccount,
      new BN(amount * 10 ** tokenConfig.decimals),
    );
  }

  cancelOrders(): void {
    assert(this.loaded);

    //TODO for every market cancel the orders.
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
    */

    throw new Error('Implement.');
  }

  async closeOpenOrders(): Promise<void> {
    await Market.closeOpenOrders(
      this.configuration,
      this.connection,
      this.owner!,
    );
  }

  async closeMarginAccount(): Promise<void> {
    assert(this.loaded);

    //await this.settleFunds();

    await this.closeOpenOrders();

    //TODO close the margin account, transfer the tokens back to the user wallet.

    this.loaded = false;
  }

  async createOpenOrders(): Promise<void> {
    assert(this.loaded);

    const markets = Object.values<Market>(this.markets);
    await Market.createOpenOrders(
      this.configuration,
      this.connection,
      this.owner!,
      markets,
      this.listening,
    );
  }

  async deposit(symbol: string, amount: number): Promise<void> {
    assert(this.loaded);

    //TODO
    throw new Error('Implement');
  }

  async listenOpenOrders(): Promise<void> {
    assert(this.loaded);
    assert(!this.listening);
    const markets = Object.values<Market>(this.markets);
    assert(markets.length > 0);
    for (const market of markets) {
      if (market.openOrders) {
        await market.listenOpenOrders(this.connection);
      }
    }
  }

  printBalance(): void {
    assert(this.loaded);

    console.log('');
    console.log(
      `  Payer balance = ${(this.payerBalance / LAMPORTS_PER_SOL).toFixed(
        2,
      )} SOL`,
    );
    console.log('');
    for (const position of Object.values<Position>(this.positions)) {
      console.log(
        `  ${position.tokenConfig.symbol} token balance = ${(
          Number(position.balance) /
          10 ** position.tokenConfig.decimals
        ).toFixed(position.tokenConfig.precision)}`,
      );
    }
    console.log('');
  }

  printOpenOrders(): void {
    assert(this.loaded);
    for (const market of Object.values<Market>(this.markets)) {
      console.log(market.marketConfig.symbol);
      if (market.openOrders) {
        console.log(`  ${market.openOrders.address}`);
        //TODO list any orders in the open orders account.
      }
      console.log('');
    }
  }

  sendOrders(orders: Order[]): void {
    (async () => {
      try {
        const transaction = new Transaction();

        for (const order of orders) {
          const market = this.markets[order.symbol];
          if (market) {
            if (!market.openOrders) {
              await Market.createOpenOrders(
                this.configuration,
                this.connection,
                this.owner!,
                [market],
                this.listening,
              );
              await market.listenOpenOrders(this.connection);
            }

            if (
              market.market!.baseSizeNumberToLots(order.size).lte(new BN(0))
            ) {
              console.log(`size = ${order.size}`);
              console.log(
                `market.baseSizeNumberToLots(size) = ${market.market!.baseSizeNumberToLots(
                  order.size,
                )}`,
              );
              console.log('size too small');
            } else if (
              market.market!.priceNumberToLots(order.price).lte(new BN(0))
            ) {
              console.log(`price = ${order.price}`);
              console.log(
                `market.priceNumberToLots(price) = ${market.market!.priceNumberToLots(
                  order.price,
                )}`,
              );
              console.log('invalid price');
            } else {
              //TODO replace existing orders.
              //replaceOrdersByClientIds

              //TODO send the orders.
              //owner: this.account,
              //payer: this.context.positions[symbol].quoteTokenAccount,
              //clientId: undefined,
              //openOrdersAddressKey: this.context.positions[symbol].openOrdersAccount,
              //feeDiscountPubkey: this.feeDiscountPubkey,

              market.market!.makeNewOrderV3Instruction({
                owner: this.owner!,
                // @ts-ignore
                payer: this.payer,
                side: order.side,
                price: order.price,
                size: order.size,
                orderType: order.orderType,
                clientId: new BN(Date.now()),
                //openOrdersAddressKey,
                //openOrdersAccount,
                //feeDiscountPubkey,
                //maxTs,
                //replaceIfExists,
              });
            }
          } else {
            console.log(`Unknown market: ${order.symbol}`);
          }
        }

        if (transaction.instructions.length > 0) {
          const txid = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [this.payer],
            {
              skipPreflight: true,
              commitment: 'processed',
            },
          );
          console.log(txid);
        }
      } catch (err) {}
    })();
  }

  async setLimits(
    symbol: string,
    minAmount: number,
    maxAmount: number,
  ): Promise<void> {
    //console.log(`minAmount = ${minAmount}`);
    //console.log(`maxAmount = ${maxAmount}`);
    assert(minAmount <= maxAmount);

    let position = this.positions[symbol];
    if (!position) {
      const tokenConfig = Object.values<TokenConfiguration>(
        this.configuration.tokens,
      ).find(tokenConfig => {
        return tokenConfig.symbol == symbol;
      });
      if (tokenConfig) {
        position = await Position.create(
          this.connection,
          this.owner!.publicKey,
          this.payer,
          tokenConfig,
        );
      }
      this.positions[symbol] = position;
    }

    position.minAmount = minAmount;
    position.maxAmount = maxAmount;

    //TODO write this to the user's margin account settings on-chain.
  }

  async settleFunds(): Promise<void> {
    assert(this.loaded);

    //TODO
    throw new Error('Implement');
  }

  async withdraw(symbol: string, amount: number): Promise<void> {
    assert(this.loaded);
    //TODO
    throw new Error('Implement');
  }
}

const airdropTokens = async (
  connection: Connection,
  faucetProgramId: PublicKey,
  feePayerAccount: Keypair,
  faucetAddress: PublicKey,
  tokenDestinationAddress: PublicKey,
  amount: BN,
) => {
  const pubkeyNonce = await PublicKey.findProgramAddress(
    [Buffer.from('faucet')],
    faucetProgramId,
  );

  const keys = [
    { pubkey: pubkeyNonce[0], isSigner: false, isWritable: false },
    {
      pubkey: await getMintPubkeyFromTokenAccountPubkey(
        connection,
        tokenDestinationAddress,
      ),
      isSigner: false,
      isWritable: true,
    },
    { pubkey: tokenDestinationAddress, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: faucetAddress, isSigner: false, isWritable: false },
  ];

  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: faucetProgramId,
      data: Buffer.from([1, ...amount.toArray('le', 8)]),
      keys,
    }),
  );
  const txid = await sendAndConfirmTransaction(
    connection,
    tx,
    [feePayerAccount],
    {
      skipPreflight: false,
      commitment: 'singleGossip',
    },
  );
};

const getMintPubkeyFromTokenAccountPubkey = async (
  connection: Connection,
  tokenAccountPubkey: PublicKey,
) => {
  try {
    const tokenMintData = (
      await connection.getParsedAccountInfo(tokenAccountPubkey, 'singleGossip')
    ).value!.data;
    //@ts-expect-error (doing the data parsing into steps so this ignore line is not moved around by formatting)
    const tokenMintAddress = tokenMintData.parsed.info.mint;

    return new PublicKey(tokenMintAddress);
  } catch (err) {
    throw new Error(
      'Error calculating mint address from token account. Are you sure you inserted a valid token account address',
    );
  }
};
