#!/usr/bin/env ts-node

import { Market } from "@project-serum/serum";
import { getMint } from "@solana/spl-token";
import { Commitment, Connection, Keypair, PublicKey } from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';

function regenerateCluster(configuration: any) {

  const newTokens = {};
  for (const key in configuration.tokens) {
    const existingToken = configuration.tokens[key];
    assert(existingToken);
    const faucetKeypair = Keypair.generate();
    const mintKeypair = Keypair.generate();
    newTokens[key] = {
      symbol: existingToken.symbol,
      decimals: existingToken.decimals,
      faucet: faucetKeypair.publicKey.toBase58(),
      faucetLimit: existingToken.faucetLimit,
      faucetPrivateKey: Buffer.from(faucetKeypair.secretKey).toString('base64'),
      mint: mintKeypair.publicKey.toBase58(),
      mintPrivateKey: Buffer.from(mintKeypair.secretKey).toString('base64'),
      supply: existingToken.supply,
    };
  }

  const newMarkets = {};
  for (const key in configuration.markets) {
    const existingMarket = configuration.markets[key];
    assert(existingMarket);
    const baseToken = newTokens[existingMarket.baseSymbol];
    assert(baseToken);
    const quoteToken = newTokens[existingMarket.quoteSymbol];
    assert(quoteToken);
    const marketKeypair: Keypair = Keypair.generate();
    const baseVaultKeypair: Keypair = Keypair.generate();
    const quoteVaultKeypair: Keypair = Keypair.generate();
    const requestQueueKeypair: Keypair = Keypair.generate();
    const eventQueueKeypair: Keypair = Keypair.generate();
    const bidsKeypair: Keypair = Keypair.generate();
    const asksKeypair: Keypair = Keypair.generate();
    newMarkets[key] = {
      symbol: existingMarket.symbol,
      market: marketKeypair.publicKey.toBase58(),
      marketPrivateKey: Buffer.from(marketKeypair.secretKey).toString('base64'),
      baseMint: baseToken.mint,
      baseDecimals: baseToken.decimals,
      baseVault: baseVaultKeypair.publicKey.toBase58(),
      baseVaultPrivateKey: Buffer.from(baseVaultKeypair.secretKey).toString('base64'),
      baseSymbol: baseToken.symbol,
      quoteMint: quoteToken.mint,
      quoteDecimals: quoteToken.decimals,
      quoteVault: quoteVaultKeypair.publicKey.toBase58(),
      quoteVaultPrivateKey: Buffer.from(quoteVaultKeypair.secretKey).toString('base64'),
      quoteSymbol: quoteToken.symbol,
      requestQueue: requestQueueKeypair.publicKey.toBase58(),
      requestQueuePrivateKey: Buffer.from(requestQueueKeypair.secretKey).toString('base64'),
      eventQueue: eventQueueKeypair.publicKey.toBase58(),
      eventQueuePrivateKey: Buffer.from(eventQueueKeypair.secretKey).toString('base64'),
      bids: bidsKeypair.publicKey.toBase58(),
      bidsPrivateKey: Buffer.from(bidsKeypair.secretKey).toString('base64'),
      asks: asksKeypair.publicKey.toBase58(),
      asksPrivateKey: Buffer.from(asksKeypair.secretKey).toString('base64'),
      quoteDustThreshold: existingMarket.quoteDustThreshold,
      baseLotSize: existingMarket.baseLotSize,
      quoteLotSize: existingMarket.quoteLotSize,
      feeRateBps: existingMarket.feeRateBps,
    };
  }

  return {
    serumProgramId: configuration.serumProgramId,
    splTokenFaucet: configuration.splTokenFaucet,
    url: configuration.url,
    tokens: newTokens,
    markets: newMarkets,
  };

}

async function refresh(configuration: any, connection: Connection) {

  const newTokens = {};
  for (const key in configuration.tokens) {
    const existingToken = configuration.tokens[key];
    assert(existingToken);
    const mintAccount = await getMint(connection, new PublicKey(existingToken.mint));
    newTokens[key] = {
      symbol: existingToken.symbol,
      mint: existingToken.mint,
      decimals: mintAccount.decimals,
    };
  }

  const newMarkets = {};
  for (const key in configuration.markets) {
    const existingMarket = configuration.markets[key];
    assert(existingMarket);
    const baseToken = newTokens[existingMarket.baseSymbol];
    assert(baseToken);
    const quoteToken = newTokens[existingMarket.quoteSymbol];
    assert(quoteToken);
    const market = await Market.load(connection, new PublicKey(existingMarket.market), { skipPreflight: true, commitment: 'processed' }, new PublicKey(configuration.serumProgramId));
    assert(baseToken.mint == market.baseMintAddress.toBase58());
    assert(quoteToken.mint == market.quoteMintAddress.toBase58());
    newMarkets[key] = {
      symbol: existingMarket.symbol,
      market: existingMarket.market,
      baseMint: baseToken.mint,
      baseDecimals: baseToken.decimals,
      baseVault: market.decoded.baseVault.toBase58(),
      baseSymbol: baseToken.symbol,
      basePrice: existingMarket.basePrice,
      quoteMint: quoteToken.mint,
      quoteDecimals: quoteToken.decimals,
      quoteVault: market.decoded.quoteVault.toBase58(),
      quoteSymbol: quoteToken.symbol,
      quotePrice: existingMarket.quotePrice,
      requestQueue: market.decoded.requestQueue,
      eventQueue: market.decoded.eventQueue,
      bids: market.decoded.bids,
      asks: market.decoded.asks,
      vaultSignerNonce: Number(market.decoded.vaultSignerNonce),
      quoteDustThreshold: Number(market.decoded.quoteDustThreshold),
      baseLotSize: Number(market.decoded.baseLotSize),
      quoteLotSize: Number(market.decoded.quoteLotSize),
      feeRateBps: Number(market.decoded.feeRateBps),
    };
  }

  return {
    pythProgramId: configuration.pythProgramId,
    serumProgramId: configuration.serumProgramId,
    url: configuration.url,
    tokens: newTokens,
    oracles: configuration.oracles,
    markets: newMarkets,
  };

}

async function regenerate() {

  const existingConfiguration = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

  const mainnetConnection = new Connection(existingConfiguration.mainnet.url, 'processed' as Commitment);

  const newConfiguration = {
    devnet: regenerateCluster(existingConfiguration.devnet),
    localnet: regenerateCluster(existingConfiguration.localnet),
    mainnet: await refresh(existingConfiguration.mainnet, mainnetConnection),
  };

  fs.writeFileSync('./config.json.new', JSON.stringify(newConfiguration, null, 2));

}

regenerate();
