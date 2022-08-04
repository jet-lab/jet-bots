import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import { homedir } from "os"
import { resolve } from "path"

import { MarginChecker, MarginInitializer } from './margin';
import { OrcaChecker, OrcaInitializer } from './orca';
import { PythChecker, PythInitializer } from './pyth';
import { SerumChecker, SerumInitializer } from './serum';
import { SolanaChecker, SolanaInitializer } from './solana';

(async () => {

  const configuration = require('./config.json').devnet;
  //const configuration = require('./config.json').localnet;
  const mainnetConfiguration = require('./config.json')['mainnet-beta'];

  const payer: Keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(resolve(homedir(), ".config/solana/id.json"), "utf-8"))))

  const solanaInitializer = new SolanaInitializer(configuration, payer);
  await solanaInitializer.initialize();

  const pythInitializer = new PythInitializer(configuration, payer);
  await pythInitializer.initialize();

  const serumInitializer = new SerumInitializer(configuration, mainnetConfiguration, payer);
  await serumInitializer.initialize();

  const marginInitializer = new MarginInitializer(configuration, payer);
  await marginInitializer.initialize();

  const orcaInitializer = new OrcaInitializer(configuration, mainnetConfiguration, payer);
  await orcaInitializer.initialize();

  console.log('');
  console.log(`[CONFIGURATION]`);
  console.log(`  configuration.url = ${JSON.stringify(configuration.url)}`);
  console.log('');

  const solanaChecker = new SolanaChecker(configuration);
  await solanaChecker.check();

  const pythChecker = new PythChecker(configuration);
  await pythChecker.check();

  const serumChecker = new SerumChecker(configuration);
  await serumChecker.check();

  const marginChecker = new MarginChecker(configuration);
  await marginChecker.check();

  const orcaChecker = new OrcaChecker(configuration);
  await orcaChecker.check();

})();
