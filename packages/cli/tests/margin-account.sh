#!/bin/bash

time ts-node ../src/index.ts create -c d -k ~/.config/solana/taker.json

time ts-node ../src/index.ts balance -c d -k ~/.config/solana/taker.json

time ts-node ../src/index.ts close -c d -k ~/.config/solana/taker.json

time ts-node ../src/index.ts balance -c d -k ~/.config/solana/taker.json
