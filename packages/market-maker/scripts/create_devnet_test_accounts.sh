#!/bin/bash

solana-keygen new --no-bip39-passphrase --outfile ~/.config/solana/maker.json
for i in $(seq 1 10); do solana -k ~/.config/solana/maker.json -u d airdrop 2; sleep 2; done

solana-keygen new --no-bip39-passphrase --outfile ~/.config/solana/taker.json
for i in $(seq 1 10); do solana -k ~/.config/solana/taker.json -u d airdrop 2; sleep 2; done

yarn ts-node src/faucet.ts
