import { BN } from '@project-serum/anchor';
import { DexInstructions, Market, OpenOrders } from '@project-serum/serum';
import { AccountLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  Account,
  AccountInfo,
  Commitment,
  Connection,
  Context,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import assert from 'assert';

import { SpotOrder } from './orders';
import { Position } from './position';
import { airdropTokens } from './utils';

export class MarginAccount {
  //address: PublicKey;
  config: any;
  connection: Connection;
  //delegate?: Account;
  owner?: Account;
  payer: Account;

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

    const serumProgramId = new PublicKey(this.config.serumProgramId);

    const openOrdersAccounts = await findOpenOrdersAccountsForOwner(
      this.connection,
      this.owner!.publicKey,
      serumProgramId,
    );

    for (const openOrdersAccount of openOrdersAccounts) {
      console.log(
        `openOrdersAccount.publicKey = ${openOrdersAccount.publicKey}`,
      );

      const openOrders = OpenOrders.fromAccountInfo(
        openOrdersAccount.publicKey,
        openOrdersAccount.accountInfo,
        serumProgramId,
      );

      assert(false);
      //TODO set this on the token account.
    }
  }

  async listen(): Promise<void> {
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

    //TODO listen to open orders.

    /*
if (
  openOrders.baseTokenFree.gt(new BN(0)) ||
  openOrders.quoteTokenFree.gt(new BN(0))
) {
  await context.bots[i].positions[symbol].settleFunds();
}
*/
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
    throw new Error('Implement.');
  }

  sendOrders(orders: SpotOrder[]): void {
    (async () => {
      try {
        const transaction = new Transaction();

        for (const order of orders) {
          const position = this.positions[order.marketConfig.symbol];

          if (!position.openOrdersAccount) {
            position.openOrdersAccount = await createOpenOrdersAccount(
              this.connection,
              order.market.address,
              this.owner!,
              order.market.programId,
            );
            //TODO listen to open orders.
          }

          if (order.market.baseSizeNumberToLots(order.size).lte(new BN(0))) {
            console.log(`size = ${order.size}`);
            console.log(
              `market.baseSizeNumberToLots(size) = ${order.market.baseSizeNumberToLots(
                order.size,
              )}`,
            );
            console.log('size too small');
          } else if (
            order.market.priceNumberToLots(order.price).lte(new BN(0))
          ) {
            console.log(`price = ${order.price}`);
            console.log(
              `market.priceNumberToLots(price) = ${order.market.priceNumberToLots(
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

            order.market.makeNewOrderV3Instruction({
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

    //TODO write this to the user's margin account settings.
  }

  async withdraw(symbol: string, amount: number): Promise<void> {
    //TODO
  }
}

async function createOpenOrdersAccount(
  connection: Connection,
  marketAddress: PublicKey,
  owner: Account,
  serumProgramId: PublicKey,
): Promise<PublicKey> {
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
}

async function findOpenOrdersAccountsForOwner(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey,
): Promise<{ publicKey: PublicKey; accountInfo: AccountInfo<Buffer> }[]> {
  const filters = [
    {
      memcmp: {
        offset: OpenOrders.getLayout(programId).offsetOf('owner'),
        bytes: owner.toBase58(),
      },
    },
    {
      dataSize: OpenOrders.getLayout(programId).span,
    },
  ];
  // @ts-ignore
  const resp = await connection._rpcRequest('getProgramAccounts', [
    programId.toBase58(),
    {
      commitment: connection.commitment,
      filters,
      encoding: 'base64',
    },
  ]);
  if (resp.error) {
    throw new Error(resp.error.message);
  }
  return resp.result.map(
    ({ pubkey, account: { data, executable, owner, lamports } }) => ({
      publicKey: new PublicKey(pubkey),
      accountInfo: {
        data: Buffer.from(data[0], 'base64'),
        executable,
        owner: new PublicKey(owner),
        lamports,
      },
    }),
  );
}
