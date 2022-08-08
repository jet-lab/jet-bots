import { BN } from "@project-serum/anchor";
import { createAssociatedTokenAccountInstruction, createInitializeMintInstruction, getMinimumBalanceForRentExemptMint, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Commitment, Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import assert from 'assert';

import { airdropTokens } from "../solana/faucet";

export class SwapChecker {
  commitment: Commitment = 'confirmed';
  configuration;
  connection: Connection;

  constructor(configuration: any) {
    this.configuration = configuration;
    this.connection = new Connection(configuration.url, this.commitment);
  }

  async check() {
    let swaps: any[] = [];
    for (const key in this.configuration.swaps) {
      swaps.push(this.configuration.swaps[key]);
    }

    for (const swap of swaps) {
      console.log(`SWAP: ${swap.symbol}`);
      console.log(`  swap = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(swap.swap)))}`);
      console.log(`  authority = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(swap.authority)))}`);
      console.log(`  poolTokenMint = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(swap.poolTokenMint)))}`);
      console.log(`  baseMint = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(swap.baseMint)))}`);
      console.log(`  baseVault = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(swap.baseVault)))}`);
      console.log(`  quoteMint = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(swap.quoteMint)))}`);
      console.log(`  quoteVault = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(swap.quoteVault)))}`);
      console.log(`  feeAccount = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(swap.feeAccount)))}`);
      console.log(`  recipientAccount = ${JSON.stringify(await this.connection.getParsedAccountInfo(new PublicKey(swap.recipientAccount)))}`);
      console.log('');
    }
  }

}

export const CurveType = Object.freeze({
  ConstantProduct: 0, // Constant product curve, Uniswap-style
  ConstantPrice: 1, // Constant price curve, always X amount of A token for 1 B token, where X is defined at init
  Offset: 3, // Offset curve, like Uniswap, but with an additional offset on the token B side
});

export class SwapInitializer {
  commitment: Commitment = 'confirmed';
  configuration;
  connection: Connection;
  mainnetConfiguration;
  orcaSwapProgramId: PublicKey;
  payer: Keypair;

  constructor(configuration: any, mainnetConfiguration: any, payer: Keypair) {
    this.configuration = configuration;
    this.connection = new Connection(configuration.url, this.commitment);
    this.mainnetConfiguration = mainnetConfiguration;
    assert(configuration.orcaSwapProgramId);
    this.orcaSwapProgramId = new PublicKey(configuration.orcaSwapProgramId);
    this.payer = payer;
  }

  async initialize(): Promise<void> {
    let swaps: any[] = [];
    for (const key in this.configuration.swaps) {
      swaps.push(this.configuration.swaps[key]);
    }

    let tokens: any[] = [];
    for (const key in this.configuration.tokens) {
      tokens.push(this.configuration.tokens[key]);
    }

    await Promise.all(
      swaps.map(async (swap) => {

        const baseToken = tokens.find((token) => { return token.mint === swap.baseMint; });
        assert(baseToken);
        const quoteToken = tokens.find((token) => { return token.mint === swap.quoteMint; });
        assert(quoteToken);

        if (baseToken.faucet && quoteToken.faucet) {
          const baseFaucet = new PublicKey(baseToken.faucet);
          const quoteFaucet = new PublicKey(quoteToken.faucet);

          if (swap.swapPrivateKey) {
            assert(swap.swapPrivateKey);
            const swapAccount = Keypair.fromSecretKey(Buffer.from(swap.swapPrivateKey, 'base64'));

            const accountInfo = await this.connection.getAccountInfo(swapAccount.publicKey);
            if (!accountInfo) {
              console.log(`createSwap(${swap.symbol})`);

              const [authority, bumpSeed] = await PublicKey.findProgramAddress([swapAccount.publicKey.toBuffer()], this.orcaSwapProgramId);
              assert(authority.equals(new PublicKey(swap.authority)));

              assert(swap.poolTokenMintPrivateKey);
              const poolTokenMint = Keypair.fromSecretKey(Buffer.from(swap.poolTokenMintPrivateKey, 'base64'));

              assert(swap.feeAccountOwnerPrivateKey);
              const feeAccountOwner = Keypair.fromSecretKey(Buffer.from(swap.feeAccountOwnerPrivateKey, 'base64'));

              assert(swap.recipientAccountOwnerPrivateKey);
              const recipientAccountOwner = Keypair.fromSecretKey(Buffer.from(swap.recipientAccountOwnerPrivateKey, 'base64'));

              await sendAndConfirmTransaction(
                this.connection,
                new Transaction().add(

                  // Create pool mint.
                  SystemProgram.createAccount({
                    fromPubkey: this.payer.publicKey,
                    newAccountPubkey: poolTokenMint.publicKey,
                    space: MINT_SIZE,
                    lamports: await getMinimumBalanceForRentExemptMint(this.connection),
                    programId: TOKEN_PROGRAM_ID,
                  }),
                  createInitializeMintInstruction(
                    poolTokenMint.publicKey,
                    swap.poolTokenDecimals,
                    authority,
                    null,
                  ),

                  // Create recipient account.
                  createAssociatedTokenAccountInstruction(
                    this.payer.publicKey,
                    new PublicKey(swap.recipientAccount),
                    recipientAccountOwner.publicKey,
                    new PublicKey(swap.poolTokenMint),
                  ),

                  // Create fee account.
                  createAssociatedTokenAccountInstruction(
                    this.payer.publicKey,
                    new PublicKey(swap.feeAccount),
                    feeAccountOwner.publicKey,
                    new PublicKey(swap.poolTokenMint),
                  ),

                  // Create token A account.
                  createAssociatedTokenAccountInstruction(
                    this.payer.publicKey,
                    new PublicKey(swap.baseVault),
                    authority,
                    new PublicKey(swap.baseMint),
                  ),

                  // Create token B account.
                  createAssociatedTokenAccountInstruction(
                    this.payer.publicKey,
                    new PublicKey(swap.quoteVault),
                    authority,
                    new PublicKey(swap.quoteMint),
                  ),

                ),
                [this.payer, poolTokenMint],
              );

              assert(this.configuration.splTokenFaucet);
              await Promise.all([
                await airdropTokens(this.connection, this.payer, baseFaucet, new PublicKey(swap.baseVault), new BN(swap.baseAmount * 10 ** baseToken.decimals), new PublicKey(this.configuration.splTokenFaucet)),
                await airdropTokens(this.connection, this.payer, quoteFaucet, new PublicKey(swap.quoteVault), new BN(swap.quoteAmount * 10 ** quoteToken.decimals), new PublicKey(this.configuration.splTokenFaucet)),
              ]);

              //TODO
              /*
              MarginSwap.create(
                this.connection,
                // @ts-ignore
                this.payer,
                swapAccount,
                authority,
                bumpSeed,
                new PublicKey(swap.baseVault),
                new PublicKey(swap.quoteVault),
                poolTokenMint.publicKey,
                new PublicKey(swap.baseMint),
                new PublicKey(swap.quoteMint),
                new PublicKey(swap.feeAccount),
                new PublicKey(swap.recipientAccount),
                this.orcaSwapProgramId,
                swap.tradeFeeNumerator,
                swap.tradeFeeDenominator,
                swap.ownerTradeFeeNumerator,
                swap.ownerTradeFeeDenominator,
                swap.ownerWithdrawFeeNumerator,
                swap.ownerWithdrawFeeDenominator,
                swap.hostFeeNumerator,
                swap.hostFeeDenominator,
                CurveType.ConstantProduct,
              );
              */
            }
          }
        }
      })
    );
  }

}
