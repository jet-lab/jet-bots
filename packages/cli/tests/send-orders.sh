#!/bin/bash

time ts-node ../src/index.ts create -c d -k ~/.config/solana/taker.json

#time ts-node ../src/index.ts airdrop -c d -k ~/.config/solana/taker.json

time ts-node ../src/index.ts balance -c d -k ~/.config/solana/taker.json

time ts-node ../src/index.ts send-test-orders -c d -k ~/.config/solana/taker.json

time ts-node ../src/index.ts cancel-orders -c d -k ~/.config/solana/taker.json

time ts-node ../src/index.ts settle-funds -c d -k ~/.config/solana/taker.json

time ts-node ../src/index.ts close -c d -k ~/.config/solana/taker.json
