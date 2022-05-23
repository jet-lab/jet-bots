import { Market } from "@project-serum/serum";
import { Account, Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';

import { Position } from '../position';
import { getAssociatedTokenAddress } from '../utils';

import { Maker } from "./maker";
import { Taker } from "./taker";
import { Strategy } from "./strategy";

export async function createStrategy(
  type: string,
  connection: Connection,
  marketConfigs: any[],
  markets: Market[],
  mainnetConnection?: Connection,
  mainnetMarkets?: Market[],
): Promise<Strategy> {

  const account = new Account(JSON.parse(fs.readFileSync(os.homedir() + `/.config/solana/${type}.json`, 'utf-8')));

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
    case 'maker': return new Maker(connection, account, positions, markets, mainnetConnection!, mainnetMarkets!);
    case 'taker': return new Taker(connection, account, positions, markets);
    default: { console.log(`Unhandled strategy type: ${type}`); process.exit(); break; }
  }

}
