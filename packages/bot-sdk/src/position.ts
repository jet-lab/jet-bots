import { BN } from '@project-serum/anchor';
import {
  AccountLayout,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  Account,
  AccountInfo,
  Commitment,
  Connection,
  Context,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import assert from 'assert';

import { Configuration, TokenConfiguration } from './configuration';

export class Position {
  configuration: Configuration;
  tokenConfiguration: TokenConfiguration;

  tokenAccount?: PublicKey;
  balance: bigint;

  // Limits
  minAmount: number = 0;
  maxAmount: number = 0;

  constructor(
    configuration: Configuration,
    tokenConfiguration: TokenConfiguration,
    tokenAccount?: PublicKey,
    balance: bigint = BigInt(0),
  ) {
    this.configuration = configuration;
    this.tokenConfiguration = tokenConfiguration;
    this.tokenAccount = tokenAccount;
    this.balance = balance;
  }

  async airdrop(connection: Connection, amount: number): Promise<void> {
    assert(this.configuration.splTokenFaucet);
    assert(this.tokenConfiguration.faucet);
    assert(this.tokenAccount);

    await airdropTokens(
      connection,
      this.configuration.splTokenFaucet,
      // @ts-ignore
      this.payer,
      new PublicKey(this.tokenConfiguration.faucet),
      this.tokenAccount,
      new BN(amount * 10 ** this.tokenConfiguration.decimals),
    );
  }

  static async createTokenAccounts(
    connection: Connection,
    owner: Account,
    payer: Account,
    positions: Position[],
  ) {
    const transaction = new Transaction();
    for (const position of positions) {
      if (!position.tokenAccount) {
        position.tokenAccount = await getAssociatedTokenAddress(
          new PublicKey(position.tokenConfiguration.mint),
          owner.publicKey, //TODO replace this with the margin account.
        );
        transaction.add(
          createAssociatedTokenAccountInstruction(
            payer.publicKey,
            position.tokenAccount,
            owner.publicKey, //TODO replace this with the margin account.
            new PublicKey(position.tokenConfiguration.mint),
          ),
        );

        //TODO listen
      }
    }
    if (transaction.instructions.length > 0) {
      const txid = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer],
        { commitment: 'processed' },
      );
      console.log(txid);
    }
  }

  async listen(connection: Connection): Promise<void> {
    console.log(
      `Listening to token account for ${this.tokenConfiguration.symbol} ${this.tokenAccount}`,
    );
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

const airdropTokens = async (
  connection: Connection,
  faucetProgramId: PublicKey,
  feePayerAccount: Keypair,
  faucetAddress: PublicKey,
  tokenDestinationAddress: PublicKey,
  amount: BN,
) => {
  const pubkeyNonce = await PublicKey.findProgramAddress(
    [Buffer.from('faucet')],
    faucetProgramId,
  );

  const keys = [
    { pubkey: pubkeyNonce[0], isSigner: false, isWritable: false },
    {
      pubkey: await getMintPubkeyFromTokenAccountPubkey(
        connection,
        tokenDestinationAddress,
      ),
      isSigner: false,
      isWritable: true,
    },
    { pubkey: tokenDestinationAddress, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: faucetAddress, isSigner: false, isWritable: false },
  ];

  const tx = new Transaction().add(
    new TransactionInstruction({
      programId: faucetProgramId,
      data: Buffer.from([1, ...amount.toArray('le', 8)]),
      keys,
    }),
  );
  const txid = await sendAndConfirmTransaction(
    connection,
    tx,
    [feePayerAccount],
    {
      skipPreflight: false,
      commitment: 'singleGossip',
    },
  );
};

const getMintPubkeyFromTokenAccountPubkey = async (
  connection: Connection,
  tokenAccountPubkey: PublicKey,
) => {
  try {
    const tokenMintData = (
      await connection.getParsedAccountInfo(tokenAccountPubkey, 'singleGossip')
    ).value!.data;
    //@ts-expect-error (doing the data parsing into steps so this ignore line is not moved around by formatting)
    const tokenMintAddress = tokenMintData.parsed.info.mint;

    return new PublicKey(tokenMintAddress);
  } catch (err) {
    throw new Error(
      'Error calculating mint address from token account. Are you sure you inserted a valid token account address',
    );
  }
};
