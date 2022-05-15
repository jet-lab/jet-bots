# Market Maker

## Purpose

This market maker bot can be used for testing on localnet or devnet. It is not recommended to use this as-is for trading on mainnet; this is a very basic implementation and you will likely lose money. It can however be used as the basis to build your own profitable trading strategy.


## Setup

To use this code you need to use yarn to install the required node_modules.

```shell
yarn install
```


## Running on Localnet

To test on localnet you can run a local validator with the Serum DEX and SPL token faucet programs loaded.

```shell
cd scripts
./run_local_validator.sh
```

The option --bpf-program allows you to preload programs into your local validator state saving the time and effort needs to deploy the programs. To clear out the validators state, simply kill and rerun the script. The option --reset will reset the validator state. This allows you to start with a clean set of markets to test with.

Once your validator is running you need to create an account and an open order account to test with. You can run create_test_accounts.sh to do this.

Next, you will ned to create some tokens to trade and some markets to trade them on. With your validator running go into the src directory and run create.ts.

```shell
cd src
./create.ts
```

This will create the sample tokens and markets described in config.json. This file was generated to create test markets for localnet, and devnet. The mainnet section is the currently actively traded addresses on mainnet.

Once you have created the test markets you will need some tokens to trade. On localnet and devent the script faucet.ts will airdrop you some samples tokens. From the src directory...

```shell
./faucet.ts
```

This script will fund you test account with SOL and SPL tokens to trade.

While running the market making bot it is often useful to be able to inspect the value of the Solana accounts being used. To print out the relevant details you can run the monitor script in the src directory.

```shell
./monitor.ts
```


## References

- This implementation was inspired by [market-maker-ts](https://github.com/blockworks-foundation/market-maker-ts/) from [🥭 Mango Markets](https://mango.markets/).
- An excellent series from Ashpool explaining how to use Serum [How Tf Do You Use Serum Ts Client?](https://ashpoolin.github.io/how-tf-do-you-use-serum-ts-client) and [The Making Of A Market Makerer](https://ashpoolin.github.io/the-making-of-a-market-makerer).
- And the Solana Cookbook examples on [Serum](https://solanacookbook.com/integrations/serum.html) and [Pyth](https://solanacookbook.com/integrations/pyth.html).
- Thank you to Paul Schaaf for the [SPL token faucet](https://github.com/paul-schaaf/spl-token-faucet) and making us all BAZILLIONAIRES on DEVNET!!!
