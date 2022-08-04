import { BN } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Account, Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';

const getMintPubkeyFromTokenAccountPubkey = async (
  connection: Connection,
  tokenAccountPubkey: PublicKey
) => {
  try {
    const tokenMintData = (
      await connection.getParsedAccountInfo(
        tokenAccountPubkey,
        "singleGossip"
      )
    ).value!.data;
    //@ts-expect-error (doing the data parsing into steps so this ignore line is not moved around by formatting)
    const tokenMintAddress = tokenMintData.parsed.info.mint;

    return new PublicKey(tokenMintAddress);
  } catch (err) {
    throw new Error(
      "Error calculating mint address from token account. Are you sure you inserted a valid token account address"
    );
  }
};

const buildAirdropTokensIx = async (
  amount: BN,
  tokenMintPublicKey: PublicKey,
  destinationAccountPubkey: PublicKey,
  faucetPubkey: PublicKey,
  faucetProgramId: PublicKey,
) => {

  const pubkeyNonce = await PublicKey.findProgramAddress([Buffer.from("faucet")], faucetProgramId);

  const keys = [
    { pubkey: pubkeyNonce[0], isSigner: false, isWritable: false },
    {
      pubkey: tokenMintPublicKey,
      isSigner: false,
      isWritable: true
    },
    { pubkey: destinationAccountPubkey, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: faucetPubkey, isSigner: false, isWritable: false }
  ];

  return new TransactionInstruction({
    programId: faucetProgramId,
    data: Buffer.from([1, ...amount.toArray("le", 8)]),
    keys
  });
};

export const airdropTokens = async (
  connection: Connection,
  feePayerAccount: Keypair,
  faucetAddress: PublicKey,
  tokenDestinationAddress: PublicKey,
  amount: BN,
  faucetProgramId: PublicKey, //const FAUCET_PROGRAM_ID = new PublicKey("4bXpkKSV8swHSnwqtzuboGPaPDeEgAn4Vt8GfarV5rZt")
) => {
  const tx = new Transaction()
    .add(await buildAirdropTokensIx(
      amount,
      await getMintPubkeyFromTokenAccountPubkey(connection, tokenDestinationAddress),
      tokenDestinationAddress,
      faucetAddress,
      faucetProgramId,
    )
  );
  await sendAndConfirmTransaction(connection, tx, [feePayerAccount], { skipPreflight: false, commitment: "singleGossip" });
};
