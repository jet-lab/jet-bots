import { PublicKey } from '@solana/web3.js';
import assert from 'assert';

import CONFIG from './config.json';

export class MarketConfiguration {
  symbol: string;
  market: PublicKey;
  baseSymbol: string;
  baseDecimals: number;
  baseLotSize: number;
  baseMint: PublicKey;
  baseVault: PublicKey;
  quoteSymbol: string;
  quoteDecimals: number;
  quoteLotSize: number;
  quoteMint: PublicKey;
  quoteVault: PublicKey;
  asks: PublicKey;
  bids: PublicKey;
  eventQueue: PublicKey;
  requestQueue: PublicKey;

  constructor(marketConfig: any) {
    this.symbol = marketConfig.symbol;
    this.market = new PublicKey(marketConfig.market);
    this.baseSymbol = marketConfig.baseSymbol;
    this.baseDecimals = marketConfig.baseDecimals;
    this.baseLotSize = marketConfig.baseLotSize;
    this.baseMint = new PublicKey(marketConfig.baseMint);
    this.baseVault = new PublicKey(marketConfig.baseVault);
    this.quoteSymbol = marketConfig.quoteSymbol;
    this.quoteDecimals = marketConfig.quoteDecimals;
    this.quoteLotSize = marketConfig.quoteLotSize;
    this.quoteMint = new PublicKey(marketConfig.quoteMint);
    this.quoteVault = new PublicKey(marketConfig.quoteVault);
    this.asks = new PublicKey(marketConfig.asks);
    this.bids = new PublicKey(marketConfig.bids);
    this.eventQueue = new PublicKey(marketConfig.eventQueue);
    this.requestQueue = new PublicKey(marketConfig.requestQueue);
  }
}

export class OracleConfiguration {
  symbol: string;
  address: PublicKey;
  product: PublicKey;
  exponent: number;

  constructor(oracleConfig: any) {
    this.symbol = oracleConfig.symbol;
    this.address = new PublicKey(oracleConfig.address);
    this.product = new PublicKey(oracleConfig.product);
    this.exponent = oracleConfig.exponent;
  }
}

export class TokenConfiguration {
  symbol: string;
  decimals: number;
  faucet?: PublicKey;
  mint: PublicKey;
  precision: number;

  constructor(tokenConfig: any) {
    this.symbol = tokenConfig.symbol;
    this.decimals = tokenConfig.decimals;
    if (tokenConfig.faucet) this.faucet = new PublicKey(tokenConfig.faucet);
    this.mint = new PublicKey(tokenConfig.mint);
    this.precision = tokenConfig.precision;
  }
}

export class Configuration {
  cluster: string;
  orcaSwapProgramId: PublicKey;
  pythProgramId: PublicKey;
  serumProgramId: PublicKey;
  serumReferralAuthority: PublicKey;
  splTokenFaucet?: PublicKey;
  url: string;
  verbose: boolean;

  markets: Record<string, MarketConfiguration> = {};
  oracles: Record<string, OracleConfiguration> = {};
  tokens: Record<string, TokenConfiguration> = {};

  constructor(cluster: string, verbose: boolean, symbols?: string[]) {
    const config =
      !symbols || symbols.length == 0
        ? loadConfig(cluster)
        : filterConfig(loadConfig(cluster), symbols);

    this.cluster = config.cluster;
    this.orcaSwapProgramId = new PublicKey(config.orcaSwapProgramId);
    this.pythProgramId = new PublicKey(config.pythProgramId);
    this.serumProgramId = new PublicKey(config.serumProgramId);
    this.serumReferralAuthority = new PublicKey(config.serumReferralAuthority);
    if (config.splTokenFaucet)
      this.splTokenFaucet = new PublicKey(config.splTokenFaucet);
    this.url = config.url;
    this.verbose = verbose;

    for (const marketConfig of Object.values<any>(config.markets)) {
      this.markets[marketConfig.symbol] = new MarketConfiguration(marketConfig);
    }
    for (const oracleConfig of Object.values<any>(config.oracles)) {
      this.oracles[oracleConfig.symbol] = new OracleConfiguration(oracleConfig);
    }
    for (const tokenConfig of Object.values<any>(config.tokens)) {
      this.tokens[tokenConfig.symbol] = new TokenConfiguration(tokenConfig);
    }
  }
}

function filterConfig(config: any, symbols: string[]) {
  const filteredConfig = { ...config, oracles: {}, markets: {} };
  Object.values<MarketConfiguration>(config.markets)
    .filter(market => {
      return symbols.includes(market.symbol);
    })
    .forEach(market => {
      filteredConfig.markets[market.symbol.replace('/', '_')] = market;
    });
  Object.values<OracleConfiguration>(config.oracles)
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
      return { cluster: 'devnet', ...CONFIG.devnet };
    }
    case 'l':
    case 'localnet': {
      assert(CONFIG.localnet);
      return { cluster: 'localnet', ...CONFIG.localnet };
    }
    case 'm':
    case 'mainnet':
    case 'mainnet-beta': {
      assert(CONFIG['mainnet-beta']);
      return { cluster: 'mainnet-beta', ...CONFIG['mainnet-beta'] };
    }
    default: {
      throw new Error(`Invalid cluster: ${cluster}`);
    }
  }
}
