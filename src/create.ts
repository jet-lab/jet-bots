#!/usr/bin/env ts-node
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';

import { BN } from "@project-serum/anchor";
import { decodeEventQueue, decodeRequestQueue, DexInstructions, Market, TokenInstructions } from "@project-serum/serum";
import { AuthorityType, createSetAuthorityInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Account, Commitment, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';

import { loadConfig } from './configuration';

import { getVaultOwnerAndNonce, toPriceLevels } from './utils';

function sleep(ms: number) { return new Promise( resolve => setTimeout(resolve, ms) ); }

async function create() {

  const account = new Account(
    JSON.parse(
      fs.readFileSync(
        process.env.KEYPAIR || os.homedir() + '/.config/solana/id.json',
        'utf-8',
      ),
    ),
  );

  const payer = account;



  const config = loadConfig('localnet');

  assert(config.splTokenFaucet);
  const splTokenFaucet = new PublicKey(config.splTokenFaucet);

  assert(config.serumProgramId);
  const serumProgramId = new PublicKey(config.serumProgramId);

  const connection = new Connection(config.url, 'processed' as Commitment);



  let balance = await connection.getBalance(payer.publicKey) / LAMPORTS_PER_SOL;

  while (balance < 20) {
    const airdropSignature = await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(airdropSignature, 'confirmed' as Commitment);
    await sleep(2000);
    balance = await connection.getBalance(payer.publicKey) / LAMPORTS_PER_SOL;
    console.log(`  Balance = ${balance} SOL`);
    console.log('');
  }




  const tokens = Object.keys(config.tokens).map((key) => { return config.tokens[key]; });

  await Promise.all(
    tokens.map(async (token) => {
      console.log(`createMintAndFaucet(${token.symbol})`);
      const faucet: Keypair = Keypair.fromSecretKey(Buffer.from(token.faucetPrivateKey, 'base64'));
      const mint: Keypair = Keypair.fromSecretKey(Buffer.from(token.mintPrivateKey, 'base64'));
      assert(token.supply);
      let transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mint.publicKey,
          space: 82,
          lamports: await connection.getMinimumBalanceForRentExemption(82),
          programId: TokenInstructions.TOKEN_PROGRAM_ID,
        }),
        TokenInstructions.initializeMint({
          mint: mint.publicKey,
          decimals: token.decimals,
          mintAuthority: payer.publicKey,
        }),
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: faucet.publicKey,
          programId: splTokenFaucet,
          space: 77,
          lamports: await connection.getMinimumBalanceForRentExemption(77),
        }),
        createSetAuthorityInstruction(
          mint.publicKey,
          payer.publicKey,
          AuthorityType.MintTokens,
          (await PublicKey.findProgramAddress([Buffer.from("faucet")], splTokenFaucet))[0],
        ),
        new TransactionInstruction({
          programId: splTokenFaucet,
          data: Buffer.from([0, ...new BN(token.faucetLimit).mul(new BN(10 ** token.decimals)).toArray("le", 8)]),
          keys: [
            { pubkey: mint.publicKey, isSigner: false, isWritable: false },
            { pubkey: faucet.publicKey, isSigner: false, isWritable: true },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
          ]
        }),
      );
      await sendAndConfirmTransaction(connection, transaction, [payer, mint, faucet]);
    })
  );

  for (const token of tokens) {
    const faucet: Keypair = Keypair.fromSecretKey(Buffer.from(token.faucetPrivateKey, 'base64'));

    const mint: Keypair = Keypair.fromSecretKey(Buffer.from(token.mintPrivateKey, 'base64'));
    assert(mint.publicKey.toBase58() == new PublicKey(token.mint).toBase58());

    const faucetParsedAccountInfo = await connection.getParsedAccountInfo(faucet.publicKey);

    const faucetArray = [...(faucetParsedAccountInfo.value?.data as Buffer)];
    assert(mint.publicKey.equals(new PublicKey(faucetArray.slice(45, 77))));
    const faucetLimit = new BN(faucetArray.slice(37, 45), undefined, "le");

    console.log(`TOKEN: ${token.symbol}`);
    console.log(`  faucet = ${JSON.stringify(faucetParsedAccountInfo)}`);
    console.log(`  faucetLimit = ${faucetLimit.toString(10)}`);
    console.log(`  mint = ${JSON.stringify(await connection.getParsedAccountInfo(mint.publicKey))}`);
    console.log('');
  }



  const markets = Object.keys(config.markets).map((key) => { return config.markets[key]; });

  await Promise.all(
    markets.map(async (market) => {
      console.log(`createMarket(${market.symbol})`);
      const marketKeypair = Keypair.fromSecretKey(Buffer.from(market.marketPrivateKey, 'base64'));
      const requestQueueKeypair = Keypair.fromSecretKey(Buffer.from(market.requestQueuePrivateKey, 'base64'));
      const eventQueueKeypair = Keypair.fromSecretKey(Buffer.from(market.eventQueuePrivateKey, 'base64'));
      const bidsKeypair = Keypair.fromSecretKey(Buffer.from(market.bidsPrivateKey, 'base64'));
      const asksKeypair = Keypair.fromSecretKey(Buffer.from(market.asksPrivateKey, 'base64'));
      const baseVaultKeypair = Keypair.fromSecretKey(Buffer.from(market.baseVaultPrivateKey, 'base64'));
      const quoteVaultKeypair = Keypair.fromSecretKey(Buffer.from(market.quoteVaultPrivateKey, 'base64'));

      const [vaultOwner, vaultSignerNonce] = await getVaultOwnerAndNonce(marketKeypair.publicKey, serumProgramId);

      const tx1 = new Transaction();
      tx1.add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: baseVaultKeypair.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(165),
          space: 165,
          programId: TOKEN_PROGRAM_ID,
        }),
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: quoteVaultKeypair.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(165),
          space: 165,
          programId: TOKEN_PROGRAM_ID,
        }),
        TokenInstructions.initializeAccount({
          account: baseVaultKeypair.publicKey,
          mint: new PublicKey(market.baseMint),
          owner: vaultOwner,
        }),
        TokenInstructions.initializeAccount({
          account: quoteVaultKeypair.publicKey,
          mint: new PublicKey(market.quoteMint),
          owner: vaultOwner,
        })
      );

      const tx2 = new Transaction();
      tx2.add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: marketKeypair.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(Market.getLayout(serumProgramId).span),
          space: Market.getLayout(serumProgramId).span,
          programId: serumProgramId,
        }),
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: requestQueueKeypair.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(5120 + 12),
          space: 5120 + 12,
          programId: serumProgramId,
        }),
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: eventQueueKeypair.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(262144 + 12),
          space: 262144 + 12,
          programId: serumProgramId,
        }),
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: bidsKeypair.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
          space: 65536 + 12,
          programId: serumProgramId,
        }),
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: asksKeypair.publicKey,
          lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
          space: 65536 + 12,
          programId: serumProgramId,
        }),
        DexInstructions.initializeMarket({
          market: marketKeypair.publicKey,
          requestQueue: requestQueueKeypair.publicKey,
          eventQueue: eventQueueKeypair.publicKey,
          bids: bidsKeypair.publicKey,
          asks: asksKeypair.publicKey,
          baseVault: baseVaultKeypair.publicKey,
          quoteVault: quoteVaultKeypair.publicKey,
          baseMint: new PublicKey(market.baseMint),
          quoteMint: new PublicKey(market.quoteMint),
          baseLotSize: new BN(market.baseLotSize),
          quoteLotSize: new BN(market.quoteLotSize),
          feeRateBps: market.feeRateBps,
          vaultSignerNonce,
          quoteDustThreshold: new BN(market.quoteDustThreshold),
          programId: serumProgramId,
        })
      );

      const transactions = [
        { transaction: tx1, signers: [payer, baseVaultKeypair, quoteVaultKeypair] },
        { transaction: tx2, signers: [payer, marketKeypair, requestQueueKeypair, eventQueueKeypair, bidsKeypair, asksKeypair] },
      ];
      for (let tx of transactions) {
        tx.transaction.feePayer = payer.publicKey;
        await sendAndConfirmTransaction(connection, tx.transaction, tx.signers);
      }
    })
  );

  for (const market of markets) {
    console.log(`MARKET: ${market.symbol}`);
    console.log(`  baseMint = ${JSON.stringify(await connection.getParsedAccountInfo(new PublicKey(market.baseMint)))}`);
    console.log(`  quoteMint = ${JSON.stringify(await connection.getParsedAccountInfo(new PublicKey(market.quoteMint)))}`);

    const requestQueueAccount = await connection.getAccountInfo(new PublicKey(market.requestQueue));
    const requests = decodeRequestQueue(requestQueueAccount!.data);
    for (const request of requests) {
      console.log(`  request = ${JSON.stringify(request)}`);
    }

    const eventQueueAccount = await connection.getAccountInfo(new PublicKey(market.eventQueue));
    const events = decodeEventQueue(eventQueueAccount!.data);
    for (const event of events) {
      console.log(`  event = ${JSON.stringify(event)}`);
    }

    const depth = 20;

    const asksAccount = await connection.getAccountInfo(new PublicKey(market.asks));
    console.log(`  asks = ${JSON.stringify(toPriceLevels((await connection.getAccountInfo(new PublicKey(market.asks)))!.data, depth, market.baseLotSize, market.baseDecimals, market.quoteLotSize, market.quoteDecimals))}`);

    const bidsAccount = await connection.getAccountInfo(new PublicKey(market.bids));
    console.log(`  bids = ${JSON.stringify(toPriceLevels((await connection.getAccountInfo(new PublicKey(market.bids)))!.data, depth, market.baseLotSize, market.baseDecimals, market.quoteLotSize, market.quoteDecimals))}`);

    console.log('');
  }

}

create();
