import { BN } from "@project-serum/anchor";
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Keypair, PublicKey } from '@solana/web3.js';
import assert from 'assert';

import { PythClient } from './pyth';

//import LENDING_POOLS from './solend/production.json';
const LENDING_POOLS: any[] = [];

import PROGRAMS from './programs.json';
import PYTH_ORACLES from './pyth/oracles.json';
import SERUM_MARKETS from './serum/markets.json';
import SOLANA_TOKENS from './solana/tokens.json';
import TOKEN_SWAPS from './orca/swaps.json';

export default class ConfigurationBuilder {
  instruments: any;
  config: any;

  constructor(instruments: any, config: any) {
    this.instruments = instruments;
    this.config = config;
  }

  public async build() {

    const generatedTokenConfigurations = this.instruments.tokens.map((symbol) => {
      const tokenConfiguration = SOLANA_TOKENS.find((tokenConfiguration) => { return symbol === tokenConfiguration.symbol; });
      assert(tokenConfiguration);
      switch (symbol) {
        case 'MSRM':
          {
            return {
              symbol,
              name: tokenConfiguration.name,
              decimals: tokenConfiguration.decimals,
              precision: tokenConfiguration.precision,
              faucet: '5xEXRCpiJJLxbzAofPRcUTtCjWL5iJ52dSUTLahmJLcm',
              faucetLimit: 1_000_000_000,
              faucetPrivateKey: "SxVwfF+aJHsk4Mj1cr0Laooc1SMQQx4Z2EgnY7Dw1NhJlPv9Rv70+wKpORJYoMruAbmVrEuLN+8/ggZKTyt/7g==",
              mint: 'HiihFm4YSoiMLnp4Y35riBu9ieDj9LzTA3NwbDEe9mc3',
              mintPrivateKey: "76iyRD9P+j3t7xvtmFAnvvYunwckZSZypDwnyoOAdPj4avKVygrNevUazPBJjfl5egwZek2202iFgyrBwp3v0A=="
            };
          }
        case 'SOL':
          {
            return {
              symbol,
              name: tokenConfiguration.name,
              decimals: tokenConfiguration.decimals,
              precision: tokenConfiguration.precision,
              mint: 'So11111111111111111111111111111111111111112',
            };
          }
        case 'SRM':
          {
            return {
              symbol,
              name: tokenConfiguration.name,
              decimals: tokenConfiguration.decimals,
              precision: tokenConfiguration.precision,
              faucet: '2pUWPKjuACUqLGqUJATHc7eTYhYQqtSWbKE77Hu5G74Q',
              faucetLimit: 1_000_000_000,
              faucetPrivateKey: "FvIcq+ciTasVSFL9Wa6qb7r8iOiF6ov0HtRBL6qqV94bBRY43fYoX2ZMhT9uQbdaU0UYD2/d8DIRbb003ZDztQ==",
              mint: '5zq1tdJfRZ8boTGjKE9dCA77nyFEm4c1uji8Q3nfWfaY',
              mintPrivateKey: "XE5yUmDjNCFyLVUw0Ke00OO6kLy2I8gLqByZ4HQ2FjZKPyUbUqNG4WR3CEE6ibHjOGAbxEtECZ/gZVlU9m+l+Q=="
            };
          }
        default:
          {
            if (this.config.devnet.tokens && this.config.devnet.tokens[symbol]) {
              return {
                symbol,
                name: tokenConfiguration.name,
                decimals: tokenConfiguration.decimals,
                precision: tokenConfiguration.precision,
                faucet: this.config.devnet.tokens[symbol].faucet,
                faucetLimit: this.config.devnet.tokens[symbol].faucetLimit,
                faucetPrivateKey: this.config.devnet.tokens[symbol].faucetPrivateKey,
                mint: this.config.devnet.tokens[symbol].mint,
                mintPrivateKey: this.config.devnet.tokens[symbol].mintPrivateKey,
              };
            } else {
              const faucetKeypair = Keypair.generate();
              const mintKeypair = Keypair.generate();
              return {
                symbol,
                name: tokenConfiguration.name,
                decimals: tokenConfiguration.decimals,
                precision: tokenConfiguration.precision,
                faucet: faucetKeypair.publicKey.toBase58(),
                faucetLimit: 1_000_000_000,
                faucetPrivateKey: Buffer.from(faucetKeypair.secretKey).toString('base64'),
                mint: mintKeypair.publicKey.toBase58(),
                mintPrivateKey: Buffer.from(mintKeypair.secretKey).toString('base64'),
              };
            }
          }
      }
    });

    let generatedOracleConfigurations: any[] = [];

    if (this.instruments.oracles && this.instruments.oracles.length > 0) {
      const pythClient = new PythClient({ pythProgramId: "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH", url: "https://api.mainnet-beta.solana.com/" });

      generatedOracleConfigurations = await Promise.all(this.instruments.oracles.map(async (symbol) => {
        const oracleConfiguration = PYTH_ORACLES.find((oracleConfiguration) => { return symbol === oracleConfiguration.symbol; });
        assert(oracleConfiguration);
        if (this.config.devnet.oracles && this.config.devnet.oracles[symbol.replace('/', '_')]) {
          return this.config.devnet.oracles[symbol.replace('/', '_')];
        } else {
          const oracleKeypair = Keypair.generate();
          const productKeypair = Keypair.generate();
          const pythPrice = await pythClient.getPythPrice(new PublicKey(oracleConfiguration.address));
          return {
            symbol,
            address: oracleKeypair.publicKey,
            privateKey: Buffer.from(oracleKeypair.secretKey).toString('base64'),
            product: productKeypair.publicKey,
            productPrivateKey: Buffer.from(productKeypair.secretKey).toString('base64'),
            price: pythPrice.price,
            confidence: pythPrice.confidence,
            exponent: pythPrice.exponent,
          };
        }
      }));
    }

    let generatedMarketConfigurations: any[] = [];

    if (this.instruments.markets.length > 0) {
      generatedMarketConfigurations = await Promise.all(this.instruments.markets.map(async (symbol) => {
        const marketConfiguration = SERUM_MARKETS.find((marketConfiguration) => { return symbol === marketConfiguration.symbol; });
        assert(marketConfiguration);

        const baseToken = generatedTokenConfigurations.find((token) => { return marketConfiguration.baseSymbol === token.symbol; });
        const quoteToken = generatedTokenConfigurations.find((token) => { return marketConfiguration.quoteSymbol === token.symbol; });

        if (this.config.devnet.markets && this.config.devnet.markets[symbol.replace('/', '_')]) {
          assert(this.config.devnet.markets[symbol.replace('/', '_')].baseMint = baseToken.mint);
          assert(this.config.devnet.markets[symbol.replace('/', '_')].baseDecimals = baseToken.decimals);
          assert(this.config.devnet.markets[symbol.replace('/', '_')].quoteMint = quoteToken.mint);
          assert(this.config.devnet.markets[symbol.replace('/', '_')].quoteDecimals = quoteToken.decimals);
          return this.config.devnet.markets[symbol.replace('/', '_')];
        } else {
          const marketKeypair: Keypair = Keypair.generate();
          const baseVaultKeypair: Keypair = Keypair.generate();
          const quoteVaultKeypair: Keypair = Keypair.generate();
          const requestQueueKeypair: Keypair = Keypair.generate();
          const eventQueueKeypair: Keypair = Keypair.generate();
          const bidsKeypair: Keypair = Keypair.generate();
          const asksKeypair: Keypair = Keypair.generate();

          return {
            symbol,
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
            quoteDustThreshold: new BN(marketConfiguration.quoteDustThreshold).toNumber(),
            baseLotSize: new BN(marketConfiguration.baseLotSize).toNumber(),
            quoteLotSize: new BN(marketConfiguration.quoteLotSize).toNumber(),
            feeRateBps: new BN(marketConfiguration.feeRateBps).toNumber(),
          };
        }
      }));
    }

    let generatedPoolConfigurations: any[] = [];

    if (this.instruments.tokens.length > 0) {
      generatedPoolConfigurations = await Promise.all(this.instruments.tokens.map(async (symbol) => {
        const token = generatedTokenConfigurations.find((token) => { return token.symbol == symbol; });
        const oracle = generatedOracleConfigurations.find((oracle) => { return oracle.symbol == symbol + '/USD'; });
        if (this.config.devnet.pools && this.config.devnet.pools[symbol.replace('/', '_')]) {
          assert(this.config.devnet.pools[symbol].tokenMint = token.mint);
          const pool = this.config.devnet.pools[symbol.replace('/', '_')];
          return {
            symbol,
            name: token.name,
            tokenMint: token.mint,
            oracle: pool.oracle,
            product: pool.product,
            feesVault: pool.feesVault,
            feesVaultPrivateKeyPrivateKey: pool.feesVaultPrivateKeyPrivateKey,
          };
        } else {
          if (oracle) {
            assert(oracle.address);
            assert(oracle.product);
            const feesVaultKeypair: Keypair = Keypair.generate();
            return {
              symbol,
              name: token.name,
              tokenMint: token.mint,
              oracle: oracle.address,
              product: oracle.product,
              feesVault: feesVaultKeypair.publicKey.toBase58(),
              feesVaultPrivateKeyPrivateKey: Buffer.from(feesVaultKeypair.secretKey).toString('base64'),
            };
          }
        }
      }).filter(pool => { return pool !== undefined; }));
    }

    let generatedSwapConfigurations: any[] = [];

    if (this.instruments.swaps.length > 0) {
      generatedSwapConfigurations = await Promise.all(this.instruments.swaps.map(async (symbol) => {
        if (this.config.devnet.swaps && this.config.devnet.swaps[symbol.replace('/', '_')]) {
          return this.config.devnet.swaps[symbol.replace('/', '_')];
        } else {
          const swapConfiguration = TOKEN_SWAPS.find((swapConfiguration) => { return symbol === swapConfiguration.symbol; });
          if (swapConfiguration) {
            const baseToken = generatedTokenConfigurations.find((token) => { return swapConfiguration.baseSymbol === token.symbol; });
            assert(baseToken);
            const quoteToken = generatedTokenConfigurations.find((token) => { return swapConfiguration.quoteSymbol === token.symbol; });
            assert(quoteToken);

            const swapKeypair: Keypair = Keypair.generate();
            const poolTokenMintKeypair: Keypair = Keypair.generate();

            //TODO The program id can be different for each cluster, so we need to compute the PDA and set it as the authority. For not it's using the devnet programid.
            const [authority, bumpSeed] = await PublicKey.findProgramAddress([swapKeypair.publicKey.toBuffer()], new PublicKey(PROGRAMS.devnet.orca_token_swap));

            const baseVault = await getAssociatedTokenAddress(new PublicKey(baseToken.mint), authority, true);
            const quoteVault = await getAssociatedTokenAddress(new PublicKey(quoteToken.mint), authority, true);

            const feeAccountOwnerKeypair: Keypair = Keypair.generate();
            const recipientAccountOwnerKeypair: Keypair = Keypair.generate();

            const feeAccount = await getAssociatedTokenAddress(poolTokenMintKeypair.publicKey, feeAccountOwnerKeypair.publicKey);
            const recipientAccount = await getAssociatedTokenAddress(poolTokenMintKeypair.publicKey, recipientAccountOwnerKeypair.publicKey);

            return {
              symbol,
              swap: swapKeypair.publicKey.toBase58(),
              swapPrivateKey: Buffer.from(swapKeypair.secretKey).toString('base64'),
              authority: authority,
              poolTokenMint: poolTokenMintKeypair.publicKey.toBase58(),
              poolTokenMintPrivateKey: Buffer.from(poolTokenMintKeypair.secretKey).toString('base64'),
              poolTokenDecimals: swapConfiguration.poolTokenDecimals,

              baseAmount: swapConfiguration.baseAmount,
              baseDecimals: baseToken.decimals,
              baseMint: baseToken.mint,
              baseSymbol: baseToken.symbol,
              baseVault: baseVault,

              quoteAmount: swapConfiguration.quoteAmount,
              quoteDecimals: quoteToken.decimals,
              quoteMint: quoteToken.mint,
              quoteSymbol: quoteToken.symbol,
              quoteVault: quoteVault,

              feeAccount: feeAccount,
              feeAccountOwner: feeAccountOwnerKeypair.publicKey.toBase58(),
              feeAccountOwnerPrivateKey: Buffer.from(feeAccountOwnerKeypair.secretKey).toString('base64'),

              recipientAccount: recipientAccount,
              recipientAccountOwner: recipientAccountOwnerKeypair.publicKey.toBase58(),
              recipientAccountOwnerPrivateKey: Buffer.from(recipientAccountOwnerKeypair.secretKey).toString('base64'),

              tradeFeeNumerator: swapConfiguration.tradeFeeNumerator,
              tradeFeeDenominator: swapConfiguration.tradeFeeDenominator,
              ownerTradeFeeNumerator: swapConfiguration.ownerTradeFeeNumerator,
              ownerTradeFeeDenominator: swapConfiguration.ownerTradeFeeDenominator,
              ownerWithdrawFeeNumerator: swapConfiguration.ownerWithdrawFeeNumerator,
              ownerWithdrawFeeDenominator: swapConfiguration.ownerWithdrawFeeDenominator,
              hostFeeNumerator: swapConfiguration.hostFeeNumerator,
              hostFeeDenominator: swapConfiguration.hostFeeDenominator,
            };
          }
        }
      }).filter(swap => { return swap !== undefined; }));
    }

    return [
      {
        "devnet": await this.buildPublic('devnet', PROGRAMS.devnet, generatedMarketConfigurations, generatedOracleConfigurations, generatedPoolConfigurations, generatedSwapConfigurations, generatedTokenConfigurations),
        "localnet": await this.buildPublic('localnet', PROGRAMS.localnet, generatedMarketConfigurations, generatedOracleConfigurations, generatedPoolConfigurations, generatedSwapConfigurations, generatedTokenConfigurations),
        "mainnet-beta": await this.buildPublic('mainnet', PROGRAMS.mainnet, SERUM_MARKETS, PYTH_ORACLES, LENDING_POOLS, TOKEN_SWAPS, SOLANA_TOKENS),
      },
      {
        "devnet": await this.buildPrivate('devnet', PROGRAMS.devnet, generatedMarketConfigurations, generatedOracleConfigurations, generatedPoolConfigurations, generatedSwapConfigurations, generatedTokenConfigurations),
        "localnet": await this.buildPrivate('localnet', PROGRAMS.localnet, generatedMarketConfigurations, generatedOracleConfigurations, generatedPoolConfigurations, generatedSwapConfigurations, generatedTokenConfigurations),
        "mainnet-beta": await this.buildPublic('mainnet', PROGRAMS.mainnet, SERUM_MARKETS, PYTH_ORACLES, LENDING_POOLS, TOKEN_SWAPS, SOLANA_TOKENS),
      }
    ];
  }

  private async buildPrivate(
    environment: string,
    marginAccounts: any,
    marketConfigurations: any,
    oracleConfigurations: any,
    poolConfigurations: any,
    swapConfigurations: any,
    tokenConfigurations: any,
  ) {

    let url;
    switch (environment) {
      case 'devnet': { url = "https://api.devnet.solana.com/"; break; }
      case 'localnet': { url = "http://127.0.0.1:8899/"; break; }
      case 'mainnet': { url = "https://solana-api.projectserum.com/"; break; }
      default: { throw new Error(`Invalid environment: ${environment}`); }
    }

    const markets = { };
    for (const symbol of this.instruments.markets) {
      const marketConfiguration = marketConfigurations.find((marketConfiguration) => { return symbol === marketConfiguration.symbol; });
      assert(marketConfiguration);
       markets[symbol.replace('/', '_')] = {
        symbol,
        ...marketConfiguration,
      };
    };

    const oracles = { };
    for (const symbol of this.instruments.oracles) {
      const oracleConfiguration = oracleConfigurations.find((oracleConfiguration) => { return oracleConfiguration.symbol === symbol; });
      assert(oracleConfiguration);
      oracles[symbol.replace('/', '_')] = {
        symbol,
        ...oracleConfiguration,
      };
    };

    const pools = { };
    for (const symbol of this.instruments.tokens) {
      const poolConfiguration = poolConfigurations.find((poolConfiguration) => { return poolConfiguration && symbol === poolConfiguration.symbol; });
      if (poolConfiguration) {
        pools[symbol] = {
          symbol,
          ...poolConfiguration,
        };
      }
    };

    const swaps = { };
    for (const symbol of this.instruments.swaps) {
      let swapConfiguration = swapConfigurations.find((swapConfiguration) => { return swapConfiguration && symbol === swapConfiguration.symbol; });
      if (swapConfiguration) {
        swaps[symbol.replace('/', '_')] = {
          symbol,
          ...swapConfiguration,
        };
      }
    };

    const tokens = { };
    for (const symbol of this.instruments.tokens) {
      const tokenConfiguration = tokenConfigurations.find((tokenConfiguration) => { return symbol === tokenConfiguration.symbol; });
      assert(tokenConfiguration);
      tokens[symbol] = {
        symbol,
        ...tokenConfiguration,
      };
    };

    return {
      controlProgramId: marginAccounts.jet_control,
      marginProgramId: marginAccounts.jet_margin,
      marginPoolProgramId: marginAccounts.jet_margin_pool,
      marginSerumProgramId: marginAccounts.jet_margin_serum,
      marginSwapProgramId: marginAccounts.jet_margin_swap,
      metadataProgramId: marginAccounts.jet_metadata,
      orcaSwapProgramId: marginAccounts.orca_token_swap,
      pythProgramId: marginAccounts.pyth,
      serumProgramId: marginAccounts.serum_dex_v3,
      serumReferralAuthority: marginAccounts.serum_referral_authority,
      splTokenFaucet: marginAccounts.spl_token_faucet,
      url,
      tokens,
      oracles,
      pools,
      markets,
      swaps,
    };
  }

  private async buildPublic(environment: string, marginAccounts: any, marketConfigurations: any, oracleConfigurations: any, poolConfigurations: any, swapConfigurations: any, tokenConfigurations: any) {
    let configuration = await this.buildPrivate(environment, marginAccounts, marketConfigurations, oracleConfigurations, poolConfigurations, swapConfigurations, tokenConfigurations);
    configuration = { ...configuration };
    configuration.tokens = this.filterSecretKeys(configuration.tokens);
    configuration.oracles = this.filterSecretKeys(configuration.oracles);
    configuration.pools = this.filterSecretKeys(configuration.pools);
    configuration.markets = this.filterSecretKeys(configuration.markets);
    configuration.swaps = this.filterSecretKeys(configuration.swaps);
    return configuration;
  }

  private filterSecretKeys(privateObj: any) {
    let publicObj = {};
    for (const key of Object.keys(privateObj)) {
      let privateItem = privateObj[key];
      let publicItem = { };
      for (const key2 of Object.keys(privateItem)) {
        if (!key2.endsWith('rivateKey') && !key2.endsWith('price') && !key2.endsWith('confidence')) {
          publicItem[key2] = privateItem[key2];
        }
      }
      publicObj[key] = publicItem;
    }
    return publicObj;
  }

}
