import { PublicKey } from '@solana/web3.js';

export interface TokenAccount {
  address: PublicKey;
  balance: bigint;
  isNative: boolean;
  mint: PublicKey;
}
