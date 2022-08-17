#!/bin/bash

#time ts-node ../src/index.ts create -c d -k ~/.config/solana/taker.json

#time ts-node ../src/index.ts airdrop -c d -k ~/.config/solana/taker.json -a 1000 -s USDC
#time ts-node ../src/index.ts balance -c d -k ~/.config/solana/taker.json

time ts-node ../src/index.ts send-test-order -c d -k ~/.config/solana/taker.json -m BTC/USDC -t USDC -p 1 -s 1
#time ts-node ../src/index.ts replace-test-order -c d -k ~/.config/solana/taker.json
#time ts-node ../src/index.ts open-orders -c d -k ~/.config/solana/taker.json

#time ts-node ../src/index.ts cancel-orders -c d -k ~/.config/solana/taker.json
#time ts-node ../src/index.ts settle-funds -c d -k ~/.config/solana/taker.json
#time ts-node ../src/index.ts close-open-orders -c d -k ~/.config/solana/taker.json
#time ts-node ../src/index.ts close -c d -k ~/.config/solana/taker.json

#time ts-node ../src/index.ts balance -c d -k ~/.config/solana/taker.json
