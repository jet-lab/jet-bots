import assert from 'assert';
import { Buffer } from 'buffer';
import { BN } from "@project-serum/anchor";
import { TokenInstructions } from '@project-serum/serum';
import { AuthorityType, createSetAuthorityInstruction, MintLayout } from "@solana/spl-token";
import { Commitment, Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from '@solana/web3.js';

export class SolanaChecker {
  commitment: Commitment = 'confirmed';
  configuration;
  connection: Connection;

  constructor(configuration: any) {
    this.configuration = configuration;
    this.connection = new Connection(configuration.url, this.commitment);
  }

  async check() {
    let tokens: any[] = [];
    for (const key in this.configuration.tokens) {
      tokens.push(this.configuration.tokens[key]);
    }

    for (const token of tokens) {
      console.log(`TOKEN: ${token.symbol}`);

      console.log(`  token = ${JSON.stringify(token)}`);
      console.log(``);

      if (token.faucetPrivateKey) {
        const faucet: Keypair = Keypair.fromSecretKey(Buffer.from(token.faucetPrivateKey, 'base64'));
        const faucetParsedAccountInfo = await this.connection.getParsedAccountInfo(faucet.publicKey);
        const faucetArray = [...(faucetParsedAccountInfo.value?.data as Buffer)];
        assert(new PublicKey(token.mint).equals(new PublicKey(faucetArray.slice(45, 77))));
        const faucetLimit = new BN(faucetArray.slice(37, 45), undefined, "le");
        console.log(`  faucet = ${JSON.stringify(faucetParsedAccountInfo)}`);
        console.log(`  faucetLimit = ${faucetLimit.toString(10)}`);
      } else if (token.faucet) {
        const faucet = new PublicKey(token.faucet);
        const faucetParsedAccountInfo = await this.connection.getParsedAccountInfo(faucet);
        const faucetArray = [...(faucetParsedAccountInfo.value?.data as Buffer)];
        assert(new PublicKey(token.mint).equals(new PublicKey(faucetArray.slice(45, 77))));
        const faucetLimit = new BN(faucetArray.slice(37, 45), undefined, "le");
        console.log(`  faucet = ${JSON.stringify(faucetParsedAccountInfo)}`);
        console.log(`  faucetLimit = ${faucetLimit.toString(10)}`);
      }

      if (token.mintPrivateKey) {
        const mint: Keypair = Keypair.fromSecretKey(Buffer.from(token.mintPrivateKey, 'base64'));
        assert(mint.publicKey.toBase58() == new PublicKey(token.mint).toBase58());
        console.log(`  mint = ${JSON.stringify(await this.connection.getParsedAccountInfo(mint.publicKey))}`);
        console.log(`  supply: ${(await this.getMintSupply(new PublicKey(token.mint), token.decimals))}`);
      } else if (token.mint) {
        const mint = new PublicKey(token.mint);
        assert(mint.toBase58() == new PublicKey(token.mint).toBase58());
        console.log(`  mint = ${JSON.stringify(await this.connection.getParsedAccountInfo(mint))}`);
        console.log(`  supply: ${(await this.getMintSupply(new PublicKey(token.mint), token.decimals))}`);
      }
    }

    console.log('');
  }

  private async getMintSupply(mintPublicKey: PublicKey, decimals: number) {
    const mintAccount = await this.connection.getAccountInfo(mintPublicKey);
    const mintInfo = MintLayout.decode(Buffer.from(mintAccount!.data));
    return mintInfo.supply;
  }

}

export class SolanaInitializer {
  commitment: Commitment = 'confirmed';
  configuration;
  connection: Connection;
  payer: Keypair;

  constructor(configuration: any, payer: Keypair) {
    this.configuration = configuration;
    this.connection = new Connection(configuration.url, this.commitment);
    this.payer = payer;
  }

  async initialize(): Promise<void> {
    assert(this.configuration.splTokenFaucet);
    const faucetProgramId = new PublicKey(this.configuration.splTokenFaucet);

    let tokens: any[] = [];
    for (const key in this.configuration.tokens) {
      tokens.push(this.configuration.tokens[key]);
    }

    await Promise.all(
      tokens.map(async (token) => {
        const transaction = new Transaction();
        const signers: Keypair[] = [this.payer];

        if (token.mintPrivateKey) {
          const accountInfo = await this.connection.getAccountInfo(new PublicKey(token.mint));
          if (!accountInfo) {
            const mint: Keypair = Keypair.fromSecretKey(Buffer.from(token.mintPrivateKey, 'base64'));
            transaction.add(
              SystemProgram.createAccount({
                fromPubkey: this.payer.publicKey,
                newAccountPubkey: mint.publicKey,
                space: 82,
                lamports: await this.connection.getMinimumBalanceForRentExemption(82),
                programId: TokenInstructions.TOKEN_PROGRAM_ID,
              }),
              TokenInstructions.initializeMint({
                mint: mint.publicKey,
                decimals: token.decimals,
                mintAuthority: this.payer.publicKey,
              })
            );
            signers.push(mint);
          }
        }

        if (token.faucetPrivateKey) {
          const accountInfo = await this.connection.getAccountInfo(new PublicKey(token.faucet));
          if (!accountInfo) {
            const faucet: Keypair = Keypair.fromSecretKey(Buffer.from(token.faucetPrivateKey, 'base64'));
            const faucetLimit = new BN(token.faucetLimit);
            const mint = new PublicKey(token.mint);
            transaction.add(
              SystemProgram.createAccount({
                fromPubkey: this.payer.publicKey,
                newAccountPubkey: faucet.publicKey,
                programId: faucetProgramId,
                space: 77,
                lamports: await this.connection.getMinimumBalanceForRentExemption(77),
              }),
              createSetAuthorityInstruction(
                mint,
                this.payer.publicKey,
                AuthorityType.MintTokens,
                (await PublicKey.findProgramAddress([Buffer.from("faucet")], faucetProgramId))[0],
              ),
              new TransactionInstruction({
                programId: faucetProgramId,
                data: Buffer.from([0, ...faucetLimit.mul(new BN(pow10(token.decimals))).toArray("le", 8)]),
                keys: [
                  { pubkey: mint, isSigner: false, isWritable: false },
                  { pubkey: faucet.publicKey, isSigner: false, isWritable: true },
                  { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
                ]
              }),
            );
            signers.push(faucet);
          }
        }

        if (transaction.instructions.length > 0) {
          console.log(`createMintAndFaucet(${token.symbol})`);
          await sendAndConfirmTransaction(this.connection, transaction, signers);
        }

      })
    );
  }

}

function pow10(decimals: number): number {
  switch(decimals) {
    case 0: return 1;
    case 6: return 1_000_000;
    case 7: return 10_000_000;
    case 8: return 100_000_000;
    case 9: return 1_000_000_000;
    default: throw new Error(`Unsupported number of decimals: ${decimals}.`);
  }
}
