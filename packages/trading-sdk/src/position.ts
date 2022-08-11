import { PublicKey } from '@solana/web3.js';

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
}
