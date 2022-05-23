#!/bin/bash

solana-keygen new --no-bip39-passphrase --outfile ~/.config/solana/maker.json
solana-keygen new --no-bip39-passphrase --outfile ~/.config/solana/maker_open_orders.json
for i in $(seq 1 10); do solana -k ~/.config/solana/maker.json -u d airdrop 2; sleep 2; done

solana-keygen new --no-bip39-passphrase --outfile ~/.config/solana/taker.json
solana-keygen new --no-bip39-passphrase --outfile ~/.config/solana/taker_open_orders.json
for i in $(seq 1 10); do solana -k ~/.config/solana/taker.json -u d airdrop 2; sleep 2; done

yarn ts-node src/faucet.ts
