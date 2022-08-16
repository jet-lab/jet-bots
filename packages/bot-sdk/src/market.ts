import { BN } from '@project-serum/anchor';
import {
  DexInstructions,
  Market as SerumMarket,
  OpenOrders,
} from '@project-serum/serum';
import { encodeInstruction } from '@project-serum/serum/lib/instructions';
import { MARKET_STATE_LAYOUT_V2 } from '@project-serum/serum/lib/market';
import {
  Account,
  AccountInfo,
  AccountMeta,
  Commitment,
  Connection,
  Context as SolanaContext,
  PublicKey,
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import assert from 'assert';

import { Configuration, MarketConfiguration } from './configuration';
import { Position } from './position';

export interface Order {
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  orderType?: 'limit' | 'ioc' | 'postOnly';
  selfTradeBehavior:
    | 'decrementTake'
    | 'cancelProvide'
    | 'abortTransaction'
    | undefined;
}

export class Market {
  market?: SerumMarket;
  marketConfig: MarketConfiguration;

  basePosition: Position;
  quotePosition: Position;
  openOrders?: OpenOrders;

  constructor(
    marketConfig: MarketConfiguration,
    positions: Record<string, Position>,
  ) {
    this.marketConfig = marketConfig;
    assert(positions[this.marketConfig.baseSymbol]);
    this.basePosition = positions[this.marketConfig.baseSymbol];
    assert(positions[this.marketConfig.quoteSymbol]);
    this.quotePosition = positions[this.marketConfig.quoteSymbol];
  }

  static async load(
    connection: Connection,
    owner: PublicKey,
    programId: PublicKey,
    markets: Market[],
  ): Promise<void> {
    const publicKeys: PublicKey[] = markets.map(market => {
      assert(market.marketConfig.market);
      return new PublicKey(market.marketConfig.market);
    });
    const accounts = await connection.getMultipleAccountsInfo(publicKeys);
    for (let i = 0; i < markets.length; i++) {
      if (accounts[i]) {
        const decoded = MARKET_STATE_LAYOUT_V2.decode(accounts[i]!.data);
        assert(markets[i].marketConfig.baseDecimals);
        assert(markets[i].marketConfig.quoteDecimals);
        markets[i].market = new SerumMarket(
          decoded,
          markets[i].marketConfig.baseDecimals,
          markets[i].marketConfig.quoteDecimals,
          {},
          programId,
        );
      }
    }

    const openOrdersAccounts = await findOpenOrdersAccountsForOwner(
      connection,
      owner,
      programId,
    );

    for (const openOrdersAccount of openOrdersAccounts) {
      const openOrders = OpenOrders.fromAccountInfo(
        openOrdersAccount.publicKey,
        openOrdersAccount.accountInfo,
        programId,
      );

      const market = markets.find(markets => {
        return (
          markets.marketConfig.market.toBase58() == openOrders.market.toBase58()
        );
      });

      if (market) {
        market.openOrders = openOrders;
      }
    }
  }

  static async closeOpenOrders(
    configuration: Configuration,
    connection: Connection,
    owner: Account,
  ): Promise<void> {
    const transaction = new Transaction();
    const openOrdersAccounts = await findOpenOrdersAccountsForOwner(
      connection,
      owner.publicKey,
      configuration.serumProgramId,
    );
    for (const openOrdersAccount of openOrdersAccounts) {
      const openOrders = OpenOrders.fromAccountInfo(
        openOrdersAccount.publicKey,
        openOrdersAccount.accountInfo,
        configuration.serumProgramId,
      );
      let hasOrders = false;
      openOrders.orders.forEach(orderId => {
        if (!orderId.eq(new BN(0))) hasOrders = true;
      });
      if (hasOrders) {
        console.log(
          `OpenOrders account still has open orders: ${openOrdersAccount.publicKey}`,
        );
        continue;
      }

      if (
        Number(openOrders.baseTokenFree) > 0 ||
        Number(openOrders.quoteTokenFree) > 0
      ) {
        const marketConfig = Object.values<MarketConfiguration>(
          configuration.markets,
        ).find(marketConfig => {
          return marketConfig.market.toBase58() == openOrders.market.toBase58();
        });
        if (marketConfig) {
          console.log(
            `OpenOrders account still has unsettled funds: ${openOrdersAccount.publicKey}`,
          );
        }
        continue;
      } else {
        transaction.add(
          DexInstructions.closeOpenOrders({
            market: new PublicKey(openOrders.market),
            openOrders: openOrdersAccount.publicKey,
            owner: owner.publicKey,
            solWallet: owner.publicKey,
            programId: configuration.serumProgramId,
          }),
        );
      }
    }
    if (transaction.instructions.length > 0) {
      const txid = await sendAndConfirmTransaction(connection, transaction, [
        owner,
      ]);
      console.log(txid);
    }
  }

  static async createOpenOrders(
    configuration: Configuration,
    connection: Connection,
    owner: Account,
    markets: Market[],
    listening: boolean,
  ): Promise<void> {
    const publicKeys: PublicKey[] = [];
    const transaction = new Transaction();
    const signers: Account[] = [];

    for (const market of markets) {
      assert(market.marketConfig);
      assert(market.market);
      if (!market.openOrders) {
        const openOrdersAccount = new Account();
        publicKeys.push(openOrdersAccount.publicKey);
        transaction.add(
          await OpenOrders.makeCreateAccountTransaction(
            connection,
            market.market.address,
            owner.publicKey,
            openOrdersAccount.publicKey,
            configuration.serumProgramId,
          ),
          DexInstructions.initOpenOrders({
            market: market.market!.address,
            openOrders: openOrdersAccount.publicKey,
            owner: owner.publicKey,
            programId: configuration.serumProgramId,
            marketAuthority: undefined,
          }),
        );
        signers.push(owner);
        signers.push(openOrdersAccount);
      }
    }

    if (transaction.instructions.length > 0) {
      const txid = await sendAndConfirmTransaction(
        connection,
        transaction,
        signers,
      );
      console.log(txid);
    }

    const openOrdersAccounts = await connection.getMultipleAccountsInfo(
      publicKeys,
    );

    for (const market of markets) {
      assert(market.market);
      if (!market.openOrders) {
        const publicKey = publicKeys.shift();
        assert(publicKey);
        const openOrdersAccount = openOrdersAccounts.shift();
        assert(openOrdersAccount);
        market.openOrders = OpenOrders.fromAccountInfo(
          publicKey,
          openOrdersAccount,
          configuration.serumProgramId,
        );
      }
    }

    //TODO if already listening, start listening to these accounts.
  }

  async listenOpenOrders(connection: Connection): Promise<void> {
    console.log(`Listening to OpenOrders for ${this.marketConfig.symbol}`);
    assert(this.openOrders);
    connection.onAccountChange(
      this.openOrders.address,
      (accountInfo: AccountInfo<Buffer>, context: SolanaContext) => {
        //TODO
      },
      'confirmed' as Commitment,
    );
    /*
    if (
      openOrders.baseTokenFree.gt(new BN(0)) ||
      openOrders.quoteTokenFree.gt(new BN(0))
    ) {
      await context.bots[i].positions[symbol].settleFunds();
    }
    */
  }

  //TODO do this in a batch.
  async settleFunds() {
    throw new Error('Implement.');

    /*
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
    const txid = await sendAndConfirmTransaction(this.connection, transaction, [
      this.account,
    ]);
    */
  }
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
