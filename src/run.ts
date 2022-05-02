#!/usr/bin/env ts-node

import yargs from 'yargs/yargs';
//const yargs = require('yargs/yargs');

(async() => {

  const argv: any = yargs(process.argv.slice(2)).options({
    c: { alias: 'cancel all open orders', default: true, type: 'boolean' },
    s: { alias: 'symbol', required: true, type: 'string' },
    close_account: { alias: 'close account', default: false, type: 'boolean' },
  }).argv;

  if (argv.c) {

    console.log('TODO cancel all open orders.');

  }

  if (argv.close_account) {

    console.log('TODO close user account.');

  }

  process.stdin.resume();

  process.on('SIGINT', () => {
    console.log('Caught keyboard interrupt. Canceling orders');

    //control.isRunning = false;
    //onExit(client, payer, mangoGroup, mangoAccount, marketContexts);

    process.exit();
  });

  console.log(`MAKING A MARKET IN ${argv.s}`);

  //while (running)
  //{

  //}

})();
