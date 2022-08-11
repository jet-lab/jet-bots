#!/usr/bin/env ts-node

import { BN } from '@project-serum/anchor';
import { parsePriceData } from '@pythnetwork/client';
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import {
  Account,
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';

import { loadConfig } from './configuration';
import { airdropTokens, getAssociatedTokenAddress } from './utils';

async function fundAccounts(
  connection: Connection,
  mainnetConnection: Connection,
  oracle: any,
  baseToken: any,
  quoteToken: any,
  quoteAmount: number,
  splTokenFaucet: PublicKey,
) {
  // Get the current token price from Pyth.
  const accountInfo = await mainnetConnection.getAccountInfo(
    new PublicKey(oracle.address),
  );
  const pythPrice = parsePriceData(accountInfo!.data);
  assert(pythPrice.price);
  const basePrice = pythPrice.price;

  const baseAmount = quoteAmount / basePrice;

  await fundAccount(
    'maker',
    connection,
    baseToken,
    baseAmount,
    quoteToken,
    quoteAmount,
    splTokenFaucet,
  );
  await fundAccount(
    'taker',
    connection,
    baseToken,
    baseAmount,
    quoteToken,
    quoteAmount,
    splTokenFaucet,
  );
}

async function fundAccount(
  name: string,
  connection: Connection,
  baseToken: any,
  baseAmount: number,
  quoteToken: any,
  quoteAmount: number,
  splTokenFaucet: PublicKey,
) {
  console.log(`fundAccount("${name}")`);

  const account = new Account(
    JSON.parse(
      fs.readFileSync(os.homedir() + `/.config/solana/${name}.json`, 'utf-8'),
    ),
  );

  // @ts-ignore
  const payer: Keypair = account;

  // Get enough SOL to pay for transactions.
  let balance =
    (await connection.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL;

  if (balance < 10) {
    const airdropSignature = await connection.requestAirdrop(
      payer.publicKey,
      10 * LAMPORTS_PER_SOL,
    );
    await connection.confirmTransaction(
      airdropSignature,
      'confirmed' as Commitment,
    );
  }

  const [baseTokenAccount, quoteTokenAccount] = await Promise.all([
    await getAssociatedTokenAddress(
      new PublicKey(baseToken.mint),
      payer.publicKey,
    ),
    await getAssociatedTokenAddress(
      new PublicKey(quoteToken.mint),
      payer.publicKey,
    ),
  ]);

  const transaction = new Transaction();
  if ((await connection.getParsedAccountInfo(baseTokenAccount)).value == null) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        baseTokenAccount,
        payer.publicKey,
        new PublicKey(baseToken.mint),
      ),
    );
  }
  if (
    (await connection.getParsedAccountInfo(quoteTokenAccount)).value == null
  ) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        quoteTokenAccount,
        payer.publicKey,
        new PublicKey(quoteToken.mint),
      ),
    );
  }
  if (transaction.instructions.length > 0) {
    await sendAndConfirmTransaction(connection, transaction, [payer], {
      commitment: 'confirmed',
    });
  }

  if (baseToken.faucet && quoteToken.faucet) {
    await Promise.all([
      await airdropTokens(
        connection,
        splTokenFaucet,
        payer,
        new PublicKey(baseToken.faucet),
        baseTokenAccount,
        new BN(baseAmount).mul(new BN(10 ** baseToken.decimals)),
      ),
      await airdropTokens(
        connection,
        splTokenFaucet,
        payer,
        new PublicKey(quoteToken.faucet),
        quoteTokenAccount,
        new BN(quoteAmount).mul(new BN(10 ** quoteToken.decimals)),
      ),
    ]);
  }

  balance = (await connection.getBalance(payer.publicKey)) / LAMPORTS_PER_SOL;
  const baseBalance = (
    await connection.getTokenAccountBalance(baseTokenAccount)
  ).value.uiAmount;
  const quoteBalance = (
    await connection.getTokenAccountBalance(quoteTokenAccount)
  ).value.uiAmount;

  console.log(`Account: ${account.publicKey.toBase58()}`);
  console.log(`  balance = ${JSON.stringify(balance)} SOL`);
  console.log(`  baseBalance = ${baseBalance} ${baseToken.symbol}`);
  console.log(`  quoteBalance = ${quoteBalance} ${quoteToken.symbol}`);
  console.log('');
}

async function fundFeeDiscountAccount(
  name: string,
  connection: Connection,
  feeDiscountToken: any,
  feeDiscountAmount: number,
  splTokenFaucet: PublicKey,
) {
  console.log(`fundFeeDiscountAccount("${name}")`);

  const account = new Account(
    JSON.parse(
      fs.readFileSync(os.homedir() + `/.config/solana/${name}.json`, 'utf-8'),
    ),
  );

  // @ts-ignore
  const payer: Keypair = account;

  const feeDiscountTokenAccount = await getAssociatedTokenAddress(
    new PublicKey(feeDiscountToken.mint),
    payer.publicKey,
  );

  if (
    (await connection.getParsedAccountInfo(feeDiscountTokenAccount)).value ==
    null
  ) {
    const transaction = new Transaction();
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        feeDiscountTokenAccount,
        payer.publicKey,
        new PublicKey(feeDiscountToken.mint),
      ),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer], {
      commitment: 'confirmed',
    });
  }

  await airdropTokens(
    connection,
    splTokenFaucet,
    payer,
    new PublicKey(feeDiscountToken.faucet),
    feeDiscountTokenAccount,
    new BN(feeDiscountAmount).mul(new BN(10 ** feeDiscountToken.decimals)),
  );

  const feeDiscountBalance = (
    await connection.getTokenAccountBalance(feeDiscountTokenAccount)
  ).value.uiAmount;

  console.log(`Account: ${account.publicKey.toBase58()}`);
  console.log(
    `  feeDiscountBalance = ${feeDiscountBalance} ${feeDiscountToken.symbol}`,
  );
  console.log('');
}

async function faucet() {
  //const config = loadConfig('localnet');
  const config = loadConfig('devnet');
  const mainnetConfig = loadConfig('mainnet');

  assert(config.splTokenFaucet);
  const splTokenFaucet = new PublicKey(config.splTokenFaucet);

  const connection = new Connection(config.url, 'processed' as Commitment);
  const mainnetConnection = new Connection(
    mainnetConfig.url,
    'processed' as Commitment,
  );

  // Assume we want 10mm in USDC and whatever base token we are trading.
  const quoteAmount = 10_000_000;

  await fundAccounts(
    connection,
    mainnetConnection,
    mainnetConfig.oracles.BTC_USD,
    config.tokens.BTC,
    config.tokens.USDC,
    quoteAmount,
    splTokenFaucet,
  );
  await fundAccounts(
    connection,
    mainnetConnection,
    mainnetConfig.oracles.ETH_USD,
    config.tokens.ETH,
    config.tokens.USDC,
    quoteAmount,
    splTokenFaucet,
  );
  //await fundAccounts(connection, mainnetConnection, mainnetConfig.oracles.SOL_USD, config.tokens.SOL, config.tokens.USDC, quoteAmount, splTokenFaucet);

  await fundFeeDiscountAccount(
    'taker',
    connection,
    config.tokens.MSRM,
    1,
    splTokenFaucet,
  );
  await fundFeeDiscountAccount(
    'taker',
    connection,
    config.tokens.SRM,
    100,
    splTokenFaucet,
  );
}

faucet();
