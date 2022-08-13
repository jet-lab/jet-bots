import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import {
  Account,
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';

export class Position {
  balance: bigint;
  decimals: number;
  isNative: boolean;
  mint: PublicKey;
  symbol: string;
  tokenAccount: PublicKey;

  // Limits
  minAmount: number = 0;
  maxAmount: number = 0;

  constructor(params: {
    balance: bigint;
    decimals: number;
    isNative: boolean;
    mint: PublicKey;
    symbol: string;
    tokenAccount: PublicKey;
  }) {
    this.balance = params.balance;
    this.decimals = params.decimals;
    this.isNative = params.isNative;
    this.mint = params.mint;
    this.symbol = params.symbol;
    this.tokenAccount = params.tokenAccount;
  }

  static async create(
    connection: Connection,
    owner: PublicKey,
    payer: Account,
    tokenConfig: any,
  ): Promise<Position> {
    const associatedTokenAddress: PublicKey = await getAssociatedTokenAddress(
      new PublicKey(tokenConfig.mint),
      owner, //TODO replace this with the margin account.
    );

    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          associatedTokenAddress,
          owner, //TODO replace this with the margin account.
          new PublicKey(tokenConfig.mint),
        ),
      ),
      [payer],
      {
        commitment: 'confirmed',
      },
    );

    return new Position({
      balance: BigInt(0),
      decimals: tokenConfig.decimals,
      isNative: tokenConfig.symbol == 'SOL', //TODO this is a hack.
      mint: new PublicKey(tokenConfig.mint),
      symbol: tokenConfig.symbol,
      tokenAccount: associatedTokenAddress,
    });
  }
}
