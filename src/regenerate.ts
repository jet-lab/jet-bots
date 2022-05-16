#!/usr/bin/env ts-node

import { Keypair } from '@solana/web3.js';
import assert from 'assert';
import * as fs from 'fs';

function regenerate(configuration: any) {

  const newTokens = {};
  Object.keys(configuration.tokens).forEach((key) => {
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
  });

  const newMarkets = {};
  Object.keys(configuration.markets).forEach((key) => {
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
  });

  return {
    serumProgramId: configuration.serumProgramId,
    splTokenFaucet: configuration.splTokenFaucet,
    url: configuration.url,
    tokens: newTokens,
    markets: newMarkets,
  };
}

(async () => {

  const existingConfiguration = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

  const newConfiguration = {
    devnet: regenerate(existingConfiguration.devnet),
    localnet: regenerate(existingConfiguration.localnet),
    mainnet: existingConfiguration.mainnet,
  };

  fs.writeFileSync('./config2.json', JSON.stringify(newConfiguration, null, 2));

})();
