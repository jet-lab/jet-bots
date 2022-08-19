#!/bin/bash

time ts-node ./src/index.ts create -c d -k ~/.config/solana/taker.json -v

#time ts-node ./src/index.ts airdrop -c d -k ~/.config/solana/taker.json -a 1000 -s USDC -v
time ts-node ./src/index.ts balance -c d -k ~/.config/solana/taker.json -v

#time ts-node ./src/index.ts asks -c d -m ETH/USDC -v
#time ts-node ./src/index.ts bids -c d -m ETH/USDC -v
time ts-node ./src/index.ts send-test-order -c d -k ~/.config/solana/taker.json -m ETH/USDC -t USDC -p 1000 -s 0.1 -v
#time ts-node ./src/index.ts ask-orders -c d -m ETH/USDC -v
#time ts-node ./src/index.ts bid-orders -c d -m ETH/USDC -v
#time ts-node ./src/index.ts open-orders -c d -k ~/.config/solana/taker.json -v

#time ts-node ./src/index.ts cancel-orders -c d -k ~/.config/solana/taker.json -v
#time ts-node ./src/index.ts settle-funds -c d -k ~/.config/solana/taker.json -v
#time ts-node ./src/index.ts close-open-orders -c d -k ~/.config/solana/taker.json -v
time ts-node ./src/index.ts close -c d -k ~/.config/solana/taker.json -v

time ts-node ./src/index.ts open-orders -c d -k ~/.config/solana/taker.json -v
time ts-node ./src/index.ts balance -c d -k ~/.config/solana/taker.json -v
