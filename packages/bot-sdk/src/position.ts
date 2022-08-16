import {
  AccountLayout,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import {
  Account,
  AccountInfo,
  Commitment,
  Connection,
  Context,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import assert from 'assert';

import { TokenConfiguration } from './configuration';

export class Position {
  tokenConfig: TokenConfiguration;

  tokenAccount?: PublicKey;
  balance: bigint;

  // Limits
  minAmount: number = 0;
  maxAmount: number = 0;

  constructor(
    tokenConfig: TokenConfiguration,
    tokenAccount?: PublicKey,
    balance: bigint = BigInt(0),
  ) {
    this.tokenConfig = tokenConfig;
    this.tokenAccount = tokenAccount;
    this.balance = balance;
  }

  static async create(
    connection: Connection,
    owner: PublicKey,
    payer: Account,
    tokenConfig: TokenConfiguration,
  ): Promise<Position> {
    const associatedTokenAddress: PublicKey = await getAssociatedTokenAddress(
      new PublicKey(tokenConfig.mint),
      owner, //TODO replace this with the margin account.
    );

    const txid = await sendAndConfirmTransaction(
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

    return new Position(tokenConfig, associatedTokenAddress, BigInt(0));
  }

  async listen(connection: Connection): Promise<void> {
    assert(this.tokenAccount);
    connection.onAccountChange(
      this.tokenAccount,
      (accountInfo: AccountInfo<Buffer>, context: Context) => {
        const tokenAccount = AccountLayout.decode(
          Buffer.from(accountInfo.data),
        );
        this.balance = tokenAccount.amount;
      },
      'confirmed' as Commitment,
    );
  }
}
