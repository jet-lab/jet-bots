import { PublicKey } from '@solana/web3.js';
import assert from 'assert';

import CONFIG from './config.json';

export class Configuration {
  orcaSwapProgramId: PublicKey;
  pythProgramId: PublicKey;
  serumProgramId: PublicKey;
  serumReferralAuthority: PublicKey;
  splTokenFaucet?: PublicKey;
  url: string;

  markets: {};
  oracles: {};
  tokens: {};

  constructor(cluster: string, symbols?: string[]) {
    const config =
      !symbols || symbols.length == 0
        ? loadConfig(cluster)
        : filterConfig(loadConfig(cluster), symbols);

    this.orcaSwapProgramId = new PublicKey(config.orcaSwapProgramId);
    this.pythProgramId = new PublicKey(config.pythProgramId);
    this.serumProgramId = new PublicKey(config.serumProgramId);
    this.serumReferralAuthority = new PublicKey(config.serumReferralAuthority);
    if (config.splTokenFaucet)
      this.splTokenFaucet = new PublicKey(config.splTokenFaucet);
    this.url = config.url;

    this.markets = config.markets;
    this.oracles = config.oracles;
    this.tokens = config.tokens;
  }
}

function filterConfig(config: any, symbols: string[]) {
  const filteredConfig = { ...config, oracles: {}, markets: {} };
  Object.values<any>(config.markets)
    .filter(market => {
      return symbols.includes(market.symbol);
    })
    .forEach(market => {
      filteredConfig.markets[market.symbol.replace('/', '_')] = market;
    });
  Object.values<any>(config.oracles)
    .filter(oracle => {
      //TODO this isn't the best way to do this.
      return (
        oracle.symbol == 'USDC/USD' ||
        symbols.includes(oracle.symbol + 'C') ||
        symbols.includes(oracle.symbol + 'T')
      );
    })
    .forEach(oracle => {
      filteredConfig.oracles[oracle.symbol.replace('/', '_')] = oracle;
    });
  return filteredConfig;
}

function loadConfig(cluster: string): any {
  switch (cluster) {
    case 'd':
    case 'devnet': {
      assert(CONFIG.devnet);
      return CONFIG.devnet;
    }
    case 'l':
    case 'localnet': {
      assert(CONFIG.localnet);
      return CONFIG.localnet;
    }
    case 'm':
    case 'mainnet':
    case 'mainnet-beta': {
      assert(CONFIG['mainnet-beta']);
      return CONFIG['mainnet-beta'];
    }
    default: {
      throw new Error(`Invalid cluster: ${cluster}`);
    }
  }
}
