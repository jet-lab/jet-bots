import { BN } from '@project-serum/anchor';
import { Market, OpenOrders } from '@project-serum/serum';
import { ORDERBOOK_LAYOUT } from '@project-serum/serum/lib/market';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  AccountInfo,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

/*
export const airdropTokens = async (
  connection: Connection,
  faucetProgramId: PublicKey,
  feePayerAccount: Keypair,
  faucetAddress: PublicKey,
  tokenDestinationAddress: PublicKey,
  amount: BN,
) => {

  const pubkeyNonce = await PublicKey.findProgramAddress([Buffer.from("faucet")], faucetProgramId);

  const keys = [
    { pubkey: pubkeyNonce[0], isSigner: false, isWritable: false },
    {
      pubkey: await getMintPubkeyFromTokenAccountPubkey(connection, tokenDestinationAddress),
      isSigner: false,
      isWritable: true
    },
    { pubkey: tokenDestinationAddress, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: faucetAddress, isSigner: false, isWritable: false }
  ];

  const tx = new Transaction()
    .add(
      new TransactionInstruction({
        programId: faucetProgramId,
        data: Buffer.from([1, ...amount.toArray("le", 8)]),
        keys
      })
    );
  await sendAndConfirmTransaction(connection, tx, [feePayerAccount], { skipPreflight: false, commitment: "singleGossip" });
};

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

export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
): Promise<PublicKey> {
  return (await PublicKey.findProgramAddress(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  ))[0];
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

const getMintPubkeyFromTokenAccountPubkey = async (
  connection: Connection,
  tokenAccountPubkey: PublicKey
) => {
  try {
    const tokenMintData = (
      await connection.getParsedAccountInfo(
        tokenAccountPubkey,
        "singleGossip"
      )
    ).value!.data;
    //@ts-expect-error (doing the data parsing into steps so this ignore line is not moved around by formatting)
    const tokenMintAddress = tokenMintData.parsed.info.mint;

    return new PublicKey(tokenMintAddress);
  } catch (err) {
    throw new Error(
      "Error calculating mint address from token account. Are you sure you inserted a valid token account address"
    );
  }
};

export function getSplTokenBalanceFromAccountInfo(
  accountInfo: AccountInfo<Buffer>,
  decimals: number,
): number {
  return divideBnToNumber(
    new BN(accountInfo.data.slice(64, 72), 10, 'le'),
    new BN(10).pow(new BN(decimals)),
  );
}

export async function getVaultOwnerAndNonce(publicKey: PublicKey, programId: PublicKey) {
  const nonce = new BN(0);
  while (nonce.toNumber() < 255) {
    try {
      const vaultOwner = await PublicKey.createProgramAddress(
        [publicKey.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
        programId
      );
      return [vaultOwner, nonce];
    } catch (e) {
      nonce.iaddn(1);
    }
  }
  throw new Error("Unable to find nonce");
}

export function sleep(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

export function toPriceLevels(data, depth: number, baseLotSize: number, baseDecimals: number, quoteLotSize: number, quoteDecimals: number): [number, number][] {
  const { accountFlags, slab } = decodeOrderBook(data);
  const descending = accountFlags.bids;
  const levels: [BN, BN][] = []; // (price, size)
  for (const { key, quantity } of slab.items(descending)) {
    const price = key.ushrn(64);
    if (levels.length > 0 && levels[levels.length - 1][0].eq(price)) {
      levels[levels.length - 1][1].iadd(quantity);
    } else {
      levels.push([price, quantity]);
    }
  }
  return levels.slice(0, 7).map(([priceLots, sizeLots]) => [
    priceLotsToNumber(priceLots, new BN(baseLotSize), baseDecimals, new BN(quoteLotSize), quoteDecimals),
    baseSizeLotsToNumber(sizeLots, new BN(baseLotSize), baseDecimals),
  ]);
}

function decodeOrderBook(buffer) {
  const { accountFlags, slab } = ORDERBOOK_LAYOUT.decode(buffer);
  return { accountFlags: accountFlags, slab: slab };
}

function priceLotsToNumber(price: BN, baseLotSize: BN, baseSplTokenDecimals: number, quoteLotSize: BN, quoteSplTokenDecimals: number) {
  return divideBnToNumber(price.mul(quoteLotSize).mul(baseSplTokenMultiplier(baseSplTokenDecimals)), baseLotSize.mul(quoteSplTokenMultiplier(quoteSplTokenDecimals)));
}

function baseSizeLotsToNumber(size: BN, baseLotSize: BN, baseSplTokenDecimals: number) {
  return divideBnToNumber(size.mul(baseLotSize), baseSplTokenMultiplier(baseSplTokenDecimals));
}

function divideBnToNumber(numerator: BN, denominator: BN): number {
  const quotient = numerator.div(denominator).toNumber();
  const rem = numerator.umod(denominator);
  const gcd = rem.gcd(denominator);
  return quotient + rem.div(gcd).toNumber() / denominator.div(gcd).toNumber();
}

function baseSplTokenMultiplier(baseSplTokenDecimals: number) {
  return new BN(10).pow(new BN(baseSplTokenDecimals));
}

function quoteSplTokenMultiplier(quoteSplTokenDecimals: number) {
  return new BN(10).pow(new BN(quoteSplTokenDecimals));
}
*/
