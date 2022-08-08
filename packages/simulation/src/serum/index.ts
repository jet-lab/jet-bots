import { BN } from "@project-serum/anchor";
import { decodeEventQueue, decodeRequestQueue, DexInstructions, Market, TokenInstructions } from "@project-serum/serum";
import { ORDERBOOK_LAYOUT } from "@project-serum/serum/lib/market";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Commitment, Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import assert from 'assert';

export class SerumChecker {
  commitment: Commitment = 'confirmed';
  configuration;
  connection: Connection;

  constructor(configuration: any) {
    this.configuration = configuration;
    this.connection = new Connection(configuration.url, this.commitment);
  }

  async check() {
    let markets: any[] = [];
    for (const key in this.configuration.markets) {
      markets.push(this.configuration.markets[key]);
    }

    for (const market of markets) {
      console.log(`MARKET: ${market.symbol}`);
      console.log(`  baseMint = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(market.baseMint)))}`);
      console.log(`  quoteMint = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(market.quoteMint)))}`);

      const requestQueueAccount = await this.connection.getAccountInfo(new PublicKey(market.requestQueue));
      const requests = decodeRequestQueue(requestQueueAccount!.data);
      for (const request of requests) {
        console.log(`  request ${JSON.stringify(request)}`);
      }

      const eventQueueAccount = await this.connection.getAccountInfo(new PublicKey(market.eventQueue));
      const events = decodeEventQueue(eventQueueAccount!.data);
      for (const event of events) {
        console.log(`  event ${JSON.stringify(event)}`);
      }

      const depth = 20;

      const asksAccount = await this.connection.getAccountInfo(new PublicKey(market.asks));
      console.log(`  asks = ${JSON.stringify(toPriceLevels((await this.connection.getAccountInfo(new PublicKey(market.asks)))!.data, depth, market.baseLotSize, market.baseDecimals, market.quoteLotSize, market.quoteDecimals))}`);

      const bidsAccount = await this.connection.getAccountInfo(new PublicKey(market.bids));
      console.log(`  bids = ${JSON.stringify(toPriceLevels((await this.connection.getAccountInfo(new PublicKey(market.bids)))!.data, depth, market.baseLotSize, market.baseDecimals, market.quoteLotSize, market.quoteDecimals))}`);

      console.log('');
    }
  }

}

export class SerumInitializer {
  commitment: Commitment = 'confirmed';
  configuration;
  connection: Connection;
  mainnetConfiguration;
  serumProgramId: PublicKey;
  payer: Keypair;

  constructor(configuration: any, mainnetConfiguration: any, payer: Keypair) {
    this.configuration = configuration;
    this.connection = new Connection(configuration.url, this.commitment);
    this.mainnetConfiguration = mainnetConfiguration;
    this.serumProgramId = new PublicKey(configuration.serumProgramId);
    this.payer = payer;
  }

  async initialize(): Promise<void> {

    let markets: any[] = [];
    for (const key in this.configuration.markets) {
      markets.push(this.configuration.markets[key]);
    }

    await Promise.all(
      markets.map(async (marketConfig) => {
        const accountInfo = await this.connection.getAccountInfo(new PublicKey(marketConfig.market));
        if (!accountInfo) {
          console.log(`createMarket(${marketConfig.symbol})`);
          const market = Keypair.fromSecretKey(Buffer.from(marketConfig.marketPrivateKey, 'base64'));
          const requestQueue = Keypair.fromSecretKey(Buffer.from(marketConfig.requestQueuePrivateKey, 'base64'));
          const eventQueue = Keypair.fromSecretKey(Buffer.from(marketConfig.eventQueuePrivateKey, 'base64'));
          const bids = Keypair.fromSecretKey(Buffer.from(marketConfig.bidsPrivateKey, 'base64'));
          const asks = Keypair.fromSecretKey(Buffer.from(marketConfig.asksPrivateKey, 'base64'));
          const baseVault = Keypair.fromSecretKey(Buffer.from(marketConfig.baseVaultPrivateKey, 'base64'));
          const quoteVault = Keypair.fromSecretKey(Buffer.from(marketConfig.quoteVaultPrivateKey, 'base64'));
          const baseMint = new PublicKey(marketConfig.baseMint);
          const quoteMint = new PublicKey(marketConfig.quoteMint);

          const [vaultOwner, vaultSignerNonce] = await this.getVaultOwnerAndNonce(market.publicKey);

          const tx1 = new Transaction();
          tx1.add(
            SystemProgram.createAccount({
              fromPubkey: this.payer.publicKey,
              newAccountPubkey: baseVault.publicKey,
              lamports: await this.connection.getMinimumBalanceForRentExemption(165),
              space: 165,
              programId: TOKEN_PROGRAM_ID,
            }),
            SystemProgram.createAccount({
              fromPubkey: this.payer.publicKey,
              newAccountPubkey: quoteVault.publicKey,
              lamports: await this.connection.getMinimumBalanceForRentExemption(165),
              space: 165,
              programId: TOKEN_PROGRAM_ID,
            }),
            TokenInstructions.initializeAccount({
              account: baseVault.publicKey,
              mint: baseMint,
              owner: vaultOwner,
            }),
            TokenInstructions.initializeAccount({
              account: quoteVault.publicKey,
              mint: quoteMint,
              owner: vaultOwner,
            })
          );

          const tx2 = new Transaction();
          tx2.add(
            SystemProgram.createAccount({
              fromPubkey: this.payer.publicKey,
              newAccountPubkey: market.publicKey,
              lamports: await this.connection.getMinimumBalanceForRentExemption(Market.getLayout(this.serumProgramId).span),
              space: Market.getLayout(this.serumProgramId).span,
              programId: this.serumProgramId,
            }),
            SystemProgram.createAccount({
              fromPubkey: this.payer.publicKey,
              newAccountPubkey: requestQueue.publicKey,
              lamports: await this.connection.getMinimumBalanceForRentExemption(5120 + 12),
              space: 5120 + 12,
              programId: this.serumProgramId,
            }),
            SystemProgram.createAccount({
              fromPubkey: this.payer.publicKey,
              newAccountPubkey: eventQueue.publicKey,
              lamports: await this.connection.getMinimumBalanceForRentExemption(262144 + 12),
              space: 262144 + 12,
              programId: this.serumProgramId,
            }),
            SystemProgram.createAccount({
              fromPubkey: this.payer.publicKey,
              newAccountPubkey: bids.publicKey,
              lamports: await this.connection.getMinimumBalanceForRentExemption(65536 + 12),
              space: 65536 + 12,
              programId: this.serumProgramId,
            }),
            SystemProgram.createAccount({
              fromPubkey: this.payer.publicKey,
              newAccountPubkey: asks.publicKey,
              lamports: await this.connection.getMinimumBalanceForRentExemption(65536 + 12),
              space: 65536 + 12,
              programId: this.serumProgramId,
            }),
            DexInstructions.initializeMarket({
              market: market.publicKey,
              requestQueue: requestQueue.publicKey,
              eventQueue: eventQueue.publicKey,
              bids: bids.publicKey,
              asks: asks.publicKey,
              baseVault: baseVault.publicKey,
              quoteVault: quoteVault.publicKey,
              baseMint,
              quoteMint,
              baseLotSize: new BN(marketConfig.baseLotSize),
              quoteLotSize: new BN(marketConfig.quoteLotSize),
              feeRateBps: marketConfig.feeRateBps,
              vaultSignerNonce,
              quoteDustThreshold: new BN(marketConfig.quoteDustThreshold),
              programId: this.serumProgramId,
            })
          );

          const transactions = [
            { transaction: tx1, signers: [this.payer, baseVault, quoteVault] },
            { transaction: tx2, signers: [this.payer, market, requestQueue, eventQueue, bids, asks] },
          ];
          for (let tx of transactions) {
            tx.transaction.feePayer = this.payer.publicKey;
            await sendAndConfirmTransaction(this.connection, tx.transaction, tx.signers);
          }
        }
      })
    );
  }

  private async getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    return (await PublicKey.findProgramAddress([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID))[0];
  }

  private async getVaultOwnerAndNonce(publicKey: PublicKey) {
    const programId: PublicKey = this.serumProgramId;
    const nonce = new BN(0);
    while (nonce.toNumber() < 255) {
      try {
        const vaultOwner = await PublicKey.createProgramAddress([publicKey.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)], programId);
        return [vaultOwner, nonce];
      } catch (e) {
        nonce.iaddn(1);
      }
    }
    throw new Error("Unable to find nonce");
  }

}

function toPriceLevels(data: any, depth: number, baseLotSize: number, baseDecimals: number, quoteLotSize: number, quoteDecimals: number): [number, number][] {
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

function decodeOrderBook(buffer: any) {
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
