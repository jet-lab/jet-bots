#!/usr/bin/env ts-node
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';

import { BN } from "@project-serum/anchor";
import { parsePriceData } from '@pythnetwork/client'
import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { Account, Commitment, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';

import { loadConfig } from './configuration';
import { airdropTokens, getAssociatedTokenAddress } from './utils';

async function faucet() {

  const account = new Account(
    JSON.parse(
      fs.readFileSync(
        process.env.KEYPAIR || os.homedir() + '/.config/solana/id.json',
        'utf-8',
      ),
    ),
  );

  // @ts-ignore
  const payer: Keypair = account;



  const config = loadConfig('localnet');
  const mainnetConfig = loadConfig('mainnet');

  assert(config.splTokenFaucet);
  const splTokenFaucet = new PublicKey(config.splTokenFaucet);

  const connection = new Connection(config.url, 'processed' as Commitment);
  const mainnetConnection = new Connection(mainnetConfig.url, 'processed' as Commitment);



  // Get enough SOL to pay for transactions.
  let balance = await connection.getBalance(payer.publicKey) / LAMPORTS_PER_SOL;

  if (balance < 10) {
    const airdropSignature = await connection.requestAirdrop(payer.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature, 'confirmed' as Commitment);
  }



  // Assume we want 10k in USDC and whatever base token we are trading.
  const quoteAmount = 10_000_000;

  const baseToken = config.tokens.SOL;
  const quoteToken = config.tokens.USDC;
  const oracle = mainnetConfig.oracles.SOL_USD;

  // Get the current token price from Pyth.
  const accountInfo = await mainnetConnection.getAccountInfo(new PublicKey(oracle.address));
  const pythPrice = parsePriceData(accountInfo!.data)
  assert(pythPrice.price);
  const basePrice = pythPrice.price;

  const baseAmount = quoteAmount / basePrice;

  const [ baseTokenAccount, quoteTokenAccount ] = await Promise.all([
    await getAssociatedTokenAddress(new PublicKey(baseToken.mint), payer.publicKey),
    await getAssociatedTokenAddress(new PublicKey(quoteToken.mint), payer.publicKey),
  ]);

  let transaction = new Transaction();
  if ((await connection.getParsedAccountInfo(baseTokenAccount)).value == null) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        baseTokenAccount,
        payer.publicKey,
        new PublicKey(baseToken.mint),
      )
    );
  }
  if ((await connection.getParsedAccountInfo(quoteTokenAccount)).value == null) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        quoteTokenAccount,
        payer.publicKey,
        new PublicKey(quoteToken.mint),
      )
    );
  }
  if (transaction.instructions.length > 0) {
    await sendAndConfirmTransaction(connection, transaction, [payer], { commitment: 'confirmed' });
  }

  await Promise.all([
    await airdropTokens(connection, splTokenFaucet, payer, new PublicKey(baseToken.faucet), baseTokenAccount, new BN(baseAmount).mul(new BN(10 ** baseToken.decimals))),
    await airdropTokens(connection, splTokenFaucet, payer, new PublicKey(quoteToken.faucet), quoteTokenAccount, new BN(quoteAmount).mul(new BN(10 ** quoteToken.decimals))),
  ]);



  balance = await connection.getBalance(payer.publicKey) / LAMPORTS_PER_SOL;
  const baseBalance = (await connection.getTokenAccountBalance(baseTokenAccount)).value.uiAmount;
  const quoteBalance = (await connection.getTokenAccountBalance(quoteTokenAccount)).value.uiAmount;

  console.log(`Account: ${account.publicKey.toBase58()}`);
  console.log(`  balance = ${JSON.stringify(balance)} SOL`);
  console.log(`  baseBalance = ${baseBalance} ${baseToken.symbol}`);
  console.log(`  quoteBalance = ${quoteBalance} ${quoteToken.symbol}`);
  console.log('');

}

faucet();
