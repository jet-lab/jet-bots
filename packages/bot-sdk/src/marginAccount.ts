import { BN } from '@project-serum/anchor';
import {
  DexInstructions,
  Market as SerumMarket,
  OpenOrders,
} from '@project-serum/serum';
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

import { Market, Order } from './market';
import { Position } from './position';

export class MarginAccount {
  //address: PublicKey;
  config: any;
  connection: Connection;
  //delegate?: Account;
  owner?: Account;
  payer: Account;

  listening: boolean = false;
  markets: Record<string, Market> = {};
  payerBalance: number = 0;
  positions: Record<string, Position> = {};

  constructor(params: {
    //address: PublicKey;
    config: any;
    connection: Connection;
    //delegate?: Account;
    owner?: Account;
    payer: Account;
  }) {
    //this.address = params.address;
    this.config = params.config;
    this.connection = params.connection;
    //this.delegate = params.delegate;
    this.owner = params.owner;
    this.payer = params.payer;
  }

  static async createMarginAccount(params: {
    config: any;
    connection: Connection;
    owner: Account;
    payer: Account;
  }): Promise<MarginAccount> {
    //TODO
    throw new Error('Implement.');
  }

  async load(): Promise<void> {
    this.payerBalance = await this.connection.getBalance(this.payer.publicKey);

    const response = await this.connection.getTokenAccountsByOwner(
      this.owner!.publicKey, //TODO replace account with a trading account, this.address,
      {
        programId: TOKEN_PROGRAM_ID,
      },
    );
    for (const item of response.value) {
      const tokenAccount = AccountLayout.decode(Buffer.from(item.account.data));
      const tokenConfig = Object.values<any>(this.config.tokens).find(
        tokenConfig => {
          return tokenConfig.mint == tokenAccount.mint.toBase58();
        },
      );
      if (tokenConfig) {
        assert(!this.positions[tokenConfig.symbol]);
        this.positions[tokenConfig.symbol] = new Position({
          balance: tokenAccount.amount,
          decimals: tokenConfig.decimals,
          isNative: Number(tokenAccount.isNative) != 0,
          mint: tokenAccount.mint,
          symbol: tokenConfig.symbol,
          tokenAccount: item.pubkey,
        });
      }
    }

    for (const marketConfig of Object.values<any>(this.config.markets)) {
      const market = new Market(marketConfig);
      this.markets[marketConfig.symbol] = market;
    }
    assert(this.config.serumProgramId);
    await Market.load(
      this.connection,
      this.owner!.publicKey,
      new PublicKey(this.config.serumProgramId),
      Object.values<Market>(this.markets),
    );
  }

  async listen(): Promise<void> {
    this.listening = true;

    this.connection.onAccountChange(
      this.payer.publicKey,
      (accountInfo: AccountInfo<Buffer>, context: Context) => {
        this.payerBalance = accountInfo.lamports;
      },
      'confirmed' as Commitment,
    );

    for (const position of Object.values<Position>(this.positions)) {
      this.connection.onAccountChange(
        position.tokenAccount,
        (accountInfo: AccountInfo<Buffer>, context: Context) => {
          const tokenAccount = AccountLayout.decode(
            Buffer.from(accountInfo.data),
          );
          position.balance = tokenAccount.amount;
        },
        'confirmed' as Commitment,
      );
    }

    for (const market of Object.values<Market>(this.markets)) {
      market.listenOpenOrders(this.connection);
    }
  }

  async airdrop(symbol: string, amount: number): Promise<void> {
    const tokenConfig = Object.values<any>(this.config.tokens).find(
      tokenConfig => {
        return tokenConfig.symbol == symbol;
      },
    );
    assert(tokenConfig);

    if (!this.positions[symbol]) {
      this.positions[symbol] = await Position.create(
        this.connection,
        this.owner!.publicKey,
        this.payer,
        tokenConfig,
      );

      //TODO listen
    }

    assert(this.positions[symbol]);
    const position = this.positions[symbol];

    assert(this.config.splTokenFaucet);
    assert(tokenConfig.faucet);

    await airdropTokens(
      this.connection,
      new PublicKey(this.config.splTokenFaucet),
      // @ts-ignore
      this.payer,
      new PublicKey(tokenConfig.faucet),
      position.tokenAccount,
      new BN(amount * 10 ** tokenConfig.decimals),
    );
  }

  cancelOrders(): void {
    //TODO for every position cancel the orders.
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
    //throw new Error('Implement.');
  }

  async closeMarginAccount(): Promise<void> {
    //TODO
    //await this.closeOpenOrdersAccounts();

    throw new Error('Implement.');

    /*
    async closeOpenOrdersAccounts() {
      console.log(
        `closeOpenOrdersAccounts ${this.context.marginAccount!.owner.publicKey}`,
      );
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
    }
    */
  }

  async createOpenOrders(): Promise<void> {
    for (const market of Object.values<Market>(this.markets)) {
      if (!market.openOrders) {
        await market.createOpenOrders(this.connection, this.owner!);
      }
    }
  }

  async deposit(symbol: string, amount: number): Promise<void> {
    //TODO
  }

  printBalance(): void {
    console.log('');
    console.log(
      `Payer balance = ${(this.payerBalance / LAMPORTS_PER_SOL).toFixed(
        2,
      )} SOL`,
    );
    for (const position of Object.values<Position>(this.positions)) {
      console.log(
        `  ${position.symbol} token balance = ${(
          Number(position.balance) /
          10 ** position.decimals
        ).toFixed(2)}`,
      );
    }
    console.log('');
  }

  printOpenOrders(): void {
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
              await market.createOpenOrders(this.connection, this.owner!);
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

        /*
        await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [this.payer],
          {
            skipPreflight: true,
            commitment: 'processed',
          },
        );
        */
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
      const tokenConfig = Object.values<any>(this.config.tokens).find(
        tokenConfig => {
          return tokenConfig.symbol == symbol;
        },
      );
      position = await Position.create(
        this.connection,
        this.owner!.publicKey,
        this.payer,
        tokenConfig,
      );
      this.positions[symbol] = position;
    }

    position.minAmount = minAmount;
    position.maxAmount = maxAmount;

    //TODO write this to the user's margin account settings on-chain.
  }

  async withdraw(symbol: string, amount: number): Promise<void> {
    //TODO
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
  await sendAndConfirmTransaction(connection, tx, [feePayerAccount], {
    skipPreflight: false,
    commitment: 'singleGossip',
  });
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
