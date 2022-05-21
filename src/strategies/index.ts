import { Market } from "@project-serum/serum";
import { Connection } from '@solana/web3.js';

import { Configuration } from '../configuration';
import { Oracle } from '../oracle';
import { PositionManager } from '../positionManager';

import { RandomTaker } from "./randomTaker";
import { ReplicateMainnet } from "./replicateMainnet";
import { Strategy } from "./strategy";

export function createStrategy(
  configuration: Configuration,
  oracle: Oracle,
  positionManager: PositionManager,
  mainnetConnection: Connection,
  mainnetMarket: Market,
): Strategy {
  switch (configuration.params.type) {
    case 'random-taker': return new RandomTaker(configuration, oracle, positionManager);
    case 'replicate-mainnet': return new ReplicateMainnet(configuration, oracle, positionManager, mainnetConnection, mainnetMarket);
    default: { console.log(`Unhandled params: ${configuration.params.type}`); process.exit(); break; }
  }
}
