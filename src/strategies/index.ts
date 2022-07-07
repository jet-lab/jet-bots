import { Market } from "@project-serum/serum";
import { Account, Connection, PublicKey } from '@solana/web3.js';
import assert from "assert";
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
  marketConfigs: Record<string, any>,
  markets: Record<string, Market>,
  mainnetConnection: Connection,
  mainnetMarkets: Record<string, Market>,
): Promise<Strategy> {

  const account = new Account(JSON.parse(fs.readFileSync(os.homedir() + `/.config/solana/${type}.json`, 'utf-8')));

  let feeDiscountPubkey: PublicKey | null = null;

  /*
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
  */

  const positions: Record<string, Position> = {};

  for (const marketConfig of Object.values<any>(marketConfigs)) {
    const market = markets[marketConfig.symbol];
    assert(market);

    const [ baseTokenAccount, quoteTokenAccount ] = await Promise.all([
      await getAssociatedTokenAddress(new PublicKey(marketConfig.baseMint), account.publicKey),
      await getAssociatedTokenAddress(new PublicKey(marketConfig.quoteMint), account.publicKey),
    ]);

    const openOrdersAccount = await Position.getOrCreateOpenOrdersAccount(connection, market.address, account, market.programId);

    const position = new Position(marketConfig, connection, account, baseTokenAccount, quoteTokenAccount, market, openOrdersAccount);
    await position.init();
    positions[marketConfig.symbol] = position;
  }

  switch (type) {
    case 'maker': return new Maker(connection, account, feeDiscountPubkey, positions, markets, mainnetConnection!, mainnetMarkets!);
    case 'taker': return new Taker(connection, account, feeDiscountPubkey, positions, markets);
    default: { console.log(`Unhandled strategy type: ${type}`); process.exit(); break; }
  }

}
