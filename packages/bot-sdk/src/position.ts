import {
  AccountLayout,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
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

export class Position {
  balance: bigint;
  decimals: number;
  isNative: boolean;
  mint: PublicKey;
  symbol: string;
  tokenAccount: PublicKey;

  // Limits
  minAmount: number = 0;
  maxAmount: number = 0;

  constructor(params: {
    balance: bigint;
    decimals: number;
    isNative: boolean;
    mint: PublicKey;
    symbol: string;
    tokenAccount: PublicKey;
  }) {
    this.balance = params.balance;
    this.decimals = params.decimals;
    this.isNative = params.isNative;
    this.mint = params.mint;
    this.symbol = params.symbol;
    this.tokenAccount = params.tokenAccount;
  }

  static async create(
    connection: Connection,
    owner: PublicKey,
    payer: Account,
    tokenConfig: any,
  ): Promise<Position> {
    const associatedTokenAddress: PublicKey = await getAssociatedTokenAddress(
      new PublicKey(tokenConfig.mint),
      owner, //TODO replace this with the margin account.
    );

    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          associatedTokenAddress,
          owner, //TODO replace this with the margin account.
          new PublicKey(tokenConfig.mint),
        ),
      ),
      [payer],
      {
        commitment: 'confirmed',
      },
    );

    return new Position({
      balance: BigInt(0),
      decimals: tokenConfig.decimals,
      isNative: tokenConfig.symbol == 'SOL', //TODO this is a hack.
      mint: new PublicKey(tokenConfig.mint),
      symbol: tokenConfig.symbol,
      tokenAccount: associatedTokenAddress,
    });
  }
}

/*
if (openOrdersAccountInfo) {
  const openOrders = OpenOrders.fromAccountInfo(
    context.bots[i].positions[symbol].openOrdersAccount,
    openOrdersAccountInfo,
    markets[symbol].programId,
  );
*/

/*
if (
  openOrders.baseTokenFree.gt(new BN(0)) ||
  openOrders.quoteTokenFree.gt(new BN(0))
) {
  await context.bots[i].positions[symbol].settleFunds();
}
*/

/*
export async function findOpenOrdersAccounts(
  connection: Connection,
  market: PublicKey,
  owner: PublicKey,
  programId: PublicKey,
): Promise<PublicKey[]> {
  const filters = [
    {
      memcmp: {
        offset: OpenOrders.getLayout(programId).offsetOf('market'),
        bytes: market.toBase58(),
      },
    },
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
  const accounts = await getFilteredProgramAccounts(
    connection,
    programId,
    filters,
  );
  return accounts.map(({ publicKey }) =>
    publicKey,
  );
}

async function getFilteredProgramAccounts(
  connection: Connection,
  programId: PublicKey,
  filters,
): Promise<{ publicKey: PublicKey; accountInfo: AccountInfo<Buffer> }[]> {
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
*/
