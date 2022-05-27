import { Market } from "@project-serum/serum";
import { Account, Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';

import { Position } from '../position';
import { getAssociatedTokenAddress, getSplTokenBalanceFromAccountInfo } from '../utils';

import { Maker } from "./maker";
import { Taker } from "./taker";
import { Strategy } from "./strategy";

export async function createStrategy(
  type: string,
  connection: Connection,
  config: any,
  marketConfigs: any[],
  markets: Market[],
  mainnetConnection?: Connection,
  mainnetMarkets?: Market[],
): Promise<Strategy> {

  const account = new Account(JSON.parse(fs.readFileSync(os.homedir() + `/.config/solana/${type}.json`, 'utf-8')));

  let feeDiscountPubkey: PublicKey | null = null;

  const msrmTokenAccounts = await connection.getTokenAccountsByOwner(account.publicKey, { mint: new PublicKey(config.tokens.MSRM.mint) });
  if (msrmTokenAccounts.value.length > 0) {
    feeDiscountPubkey = msrmTokenAccounts.value[0].pubkey;
  } else {
    const srmTokenAccounts = await connection.getTokenAccountsByOwner(account.publicKey, { mint: new PublicKey(config.tokens.SRM.mint) });
    if (srmTokenAccounts.value.length > 0) {
      let max = 0;
      srmTokenAccounts.value.forEach(({ pubkey, account }) => {
        const balance = getSplTokenBalanceFromAccountInfo(account, config.tokens.SRM.decimals);
        if (balance > max) {
          max = balance;
          feeDiscountPubkey = pubkey;
        }
      });
    }
  }

  const positions: Position[] = [];

  for (let i = 0; i < marketConfigs.length; i++) {
    const [ baseTokenAccount, quoteTokenAccount ] = await Promise.all([
      await getAssociatedTokenAddress(new PublicKey(marketConfigs[i].baseMint), account.publicKey),
      await getAssociatedTokenAddress(new PublicKey(marketConfigs[i].quoteMint), account.publicKey),
    ]);
    const openOrdersAccount = await Position.getOrCreateOpenOrdersAccount(connection, markets[i].address, account, markets[i].programId);
    const position = new Position(marketConfigs[i], connection, account, baseTokenAccount, quoteTokenAccount, markets[i], openOrdersAccount);
    await position.init();
    positions.push(position);
  }

  switch (type) {
    case 'maker': return new Maker(connection, account, feeDiscountPubkey, positions, markets, mainnetConnection!, mainnetMarkets!);
    case 'taker': return new Taker(connection, account, feeDiscountPubkey, positions, markets);
    default: { console.log(`Unhandled strategy type: ${type}`); process.exit(); break; }
  }

}
