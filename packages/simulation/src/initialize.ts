import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import { homedir } from "os"
import { resolve } from "path"

import { SwapChecker, SwapInitializer } from './orca';
import { SerumChecker, SerumInitializer } from './serum';
import { SolanaChecker, SolanaInitializer } from './solana';

(async () => {

  const configuration = require('./config.json').localnet;
  const mainnetConfiguration = require('./config.json')['mainnet-beta'];

  const payer: Keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(resolve(homedir(), ".config/solana/id.json"), "utf-8"))))

  const solanaInitializer = new SolanaInitializer(configuration, payer);
  await solanaInitializer.initialize();

  const serumInitializer = new SerumInitializer(configuration, mainnetConfiguration, payer);
  await serumInitializer.initialize();

  const swapInitializer = new SwapInitializer(configuration, mainnetConfiguration, payer);
  await swapInitializer.initialize();

  console.log('');
  console.log(`[CONFIGURATION]`);
  console.log(`  configuration.url = ${JSON.stringify(configuration.url)}`);
  console.log('');

  const solanaChecker = new SolanaChecker(configuration);
  await solanaChecker.check();

  const serumChecker = new SerumChecker(configuration);
  await serumChecker.check();

  const swapChecker = new SwapChecker(configuration);
  await swapChecker.check();

})();
