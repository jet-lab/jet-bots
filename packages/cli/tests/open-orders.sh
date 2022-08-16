#!/bin/bash

time ts-node ../src/index.ts create-open-orders -c d -k ~/.config/solana/taker.json; echo ''

time ts-node ../src/index.ts open-orders -c d -k ~/.config/solana/taker.json; echo ''

time ts-node ../src/index.ts close open-orders -c d -k ~/.config/solana/taker.json; echo ''

time ts-node ../src/index.ts open-orders -c d -k ~/.config/solana/taker.json; echo ''
