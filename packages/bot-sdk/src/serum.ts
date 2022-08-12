import { BN } from '@project-serum/anchor';
import { Market } from '@project-serum/serum';
import { OrderParams } from '@project-serum/serum/lib/market';
import {
  Account,
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import assert from 'assert';

export async function getOrCreateOpenOrdersAccount(
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

/*
export async closeOpenOrdersAccounts() {
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

/*
async function settleFunds() {
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

export async function placeOrder(
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

  const { transaction, signers } = await makePlaceOrderTransaction<Account>(
    market,
    {
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
    },
  );
  return await sendAndConfirmTransaction(
    connection,
    transaction,
    [owner, ...signers],
    { skipPreflight: true, commitment: 'processed' },
  );
}

async function makePlaceOrderTransaction<T extends PublicKey | Account>(
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

  const placeOrderInstruction = makePlaceOrderInstruction(market, {
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

function makePlaceOrderInstruction<T extends PublicKey | Account>(
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
