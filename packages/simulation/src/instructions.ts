import { PublicKey, TransactionInstruction } from '@solana/web3.js';

function accountsArray(
  ctx,
  accounts,
  ixName?: string
) {
  if (!ctx) {
    return [];
  }

  return accounts
    .map((acc) => {
      // Nested accounts.
      const nestedAccounts =
        "accounts" in acc ? acc.accounts : undefined;
      if (nestedAccounts !== undefined) {
        const rpcAccs = ctx[acc.name];
        return accountsArray(
          rpcAccs,
          acc.accounts,
          ixName
        ).flat();
      } else {
        const account = acc;
        let pubkey;
        try {
          pubkey = translateAddress(ctx[acc.name]);
        } catch (err) {
          throw new Error(
            `Wrong input type for account "${
              acc.name
            }" in the instruction accounts object${
              ixName !== undefined ? ' for instruction "' + ixName + '"' : ""
            }. Expected PublicKey or string.`
          );
        }
        return {
          pubkey,
          isWritable: account.isMut,
          isSigner: account.isSigner,
        };
      }
    })
    .flat();
}

function splitArgsAndCtx(
  idlIx: any,
  args: any[]
): [any[], any] {
  let options: any = {};
  const inputLen = idlIx.args ? idlIx.args.length : 0;
  if (args.length > inputLen) {
    if (args.length !== inputLen + 1) {
      throw new Error(
        `provided too many arguments ${args} to instruction ${
          idlIx?.name
        } expecting: ${idlIx.args?.map((a) => a.name) ?? []}`
      );
    }
    options = args.pop();
  }
  return [args, options];
}

function toInstruction(
  idlIx,
  ...args: any[]
) {
  if (idlIx.args.length != args.length) {
    throw new Error("Invalid argument length");
  }
  const ix: { [key: string]: any } = {};
  let idx = 0;
  idlIx.args.forEach((ixArg) => {
    ix[ixArg.name] = args[idx];
    idx += 1;
  });

  return ix;
}

function translateAddress(address): PublicKey {
  return address instanceof PublicKey ? address : new PublicKey(address);
}

function validateAccounts(
  ixAccounts,
  accounts,
) {
  ixAccounts.forEach((acc) => {
    if ("accounts" in acc) {
      validateAccounts(acc.accounts, accounts[acc.name]);
    } else {
      if (accounts[acc.name] === undefined) {
        throw new Error(`Invalid arguments: ${acc.name} not provided.`);
      }
    }
  });
}

export function buildInstruction(
  idlIx,
  encodeFn,
  programId: PublicKey
) {
  const ix = (
    ...args
  ): TransactionInstruction => {
    const [ixArgs, ctx] = splitArgsAndCtx(idlIx, [...args]);
    validateAccounts(idlIx.accounts, ctx.accounts);

    const keys = ix.accounts(ctx.accounts);

    if (ctx.remainingAccounts !== undefined) {
      keys.push(...ctx.remainingAccounts);
    }

    return new TransactionInstruction({
      keys,
      programId,
      data: encodeFn(idlIx.name, toInstruction(idlIx, ...ixArgs)),
    });
  };

  // Utility fn for ordering the accounts for this instruction.
  ix["accounts"] = (accs: any) => {
    return accountsArray(
      accs,
      idlIx.accounts,
      idlIx.name
    );
  };

  return ix;
}
