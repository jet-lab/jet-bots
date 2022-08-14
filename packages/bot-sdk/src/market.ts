import {
  DexInstructions,
  Market as SerumMarket,
  OpenOrders,
} from '@project-serum/serum';
import { MARKET_STATE_LAYOUT_V2 } from '@project-serum/serum/lib/market';
import {
  Account,
  AccountInfo,
  Commitment,
  Connection,
  Context as SolanaContext,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import assert from 'assert';

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
  marketConfig: any;
  openOrders?: OpenOrders;

  constructor(marketConfig: any) {
    this.marketConfig = marketConfig;
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

    for (const account of openOrdersAccounts) {
      const openOrders = OpenOrders.fromAccountInfo(
        account.publicKey,
        account.accountInfo,
        programId,
      );

      const market = markets.find(markets => {
        return markets.marketConfig.market == openOrders.market.toBase58();
      });

      if (market) {
        market.openOrders = openOrders;
      }
    }
  }

  async createOpenOrders(
    connection: Connection,
    owner: Account,
  ): Promise<void> {
    if (this.market) {
      const openOrdersAccount = await createOpenOrdersAccount(
        connection,
        this.market.address,
        owner,
        this.market.programId,
      );
      this.openOrders = await OpenOrders.load(
        connection,
        openOrdersAccount,
        this.market.programId,
      );
    } else {
      throw new Error(`Market is not loaded.`);
    }
  }

  async listenOpenOrders(connection: Connection): Promise<void> {
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
    { commitment: 'processed' },
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
