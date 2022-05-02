#!/usr/bin/env node

import yargs from 'yargs/yargs';

const argv: any = yargs(process.argv.slice(2)).options({
  c: { alias: 'cancel all open orders', default: true, type: 'boolean' },
  close_account: { alias: 'close account', default: false, type: 'boolean' },
}).argv;

(async() => {

  if (argv.c) {

    console.log('TODO cancel all open orders.');

  }

  if (argv.close_account) {

    console.log('TODO close user account.');

  }

})();
