#!/bin/bash

for i in $(seq 1 10); do solana -k ~/.config/solana/maker.json -u l airdrop 2; sleep 2; done

for i in $(seq 1 10); do solana -k ~/.config/solana/taker.json -u l airdrop 2; sleep 2; done

yarn ts-node src/faucet.ts
