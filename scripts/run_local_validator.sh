#!/bin/bash

rm -rf test-ledger

solana-test-validator --reset \
  --bpf-program 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin ../deps/serum_dex_v3.so \
  --bpf-program 4bXpkKSV8swHSnwqtzuboGPaPDeEgAn4Vt8GfarV5rZt ../deps/spl_token_faucet.so
