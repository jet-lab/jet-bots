#!/bin/bash

solana-keygen new --no-bip39-passphrase --outfile ~/.config/solana/maker.json
solana -k ~/.config/solana/maker.json -u d airdrop 2

sleep 2

solana-keygen new --no-bip39-passphrase --outfile ~/.config/solana/taker.json
solana -k ~/.config/solana/taker.json -u d airdrop 2
