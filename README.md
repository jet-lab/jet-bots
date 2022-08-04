# Jet Trading



## Prerequisites

* Node 16+
* PNPM

If you have Node 16+, you can [activate PNPM with Corepack](https://pnpm.io/installation#using-corepack):
```shell
corepack enable
corepack prepare pnpm@`npm info pnpm --json | jq -r .version` --activate
```

Corepack requires a version to enable, so if you don't have [jq](https://stedolan.github.io/jq/) installed, you can [install it](https://formulae.brew.sh/formula/jq), or just manually get the current version of pnpm with `npm info pnpm` and use it like this:

```shell
corepack prepare pnpm@7.8.0 --activate
```

## Setup

```shell
git clone https://github.com/jet-lab/solana-trading.git
cd solana-trading
pnpm install
```

## Build

Run this to build all your workspace packages.

```shell
pnpm build
```

This will build workspace packages that use `tsc` for compilation first, then everything else.

## Watch

Run this to build and watch workspace packages that use `tsc` for compilation.

```shell
pnpm watch
```

Other packages can build and run with their own tools (like CRA's react-scripts commands).

## Run (with HMR)

Run this in a separate terminal from the `watch` command.

```shell
cd packages/app/create-react-app
pnpm start
```

A basic CRA app will now be running. Go change the file [`packages/core/base/src/utils.ts`](./packages/core/base/src/utils.ts). This file is used by the file [`packages/ui/react/src/HelloWorld.tsx`](./packages/ui/react/src/HelloWorld.tsx), which is used by the CRA app.

Change the string `'Hello, world!'` to some other string, and save the file. The CRA app should update automatically, reflecting this deeply nested change.








## Purpose

This market maker bot can be used for testing on devnet or localnet. It is not recommended to use this as-is for trading on mainnet; this is a very basic implementation and you will likely lose money. It can however be used as the basis to build your own profitable trading strategy.


## Setup

To use this code you need to use yarn to install the required node_modules.

```shell
yarn install
```


## Running on Devnet

To run the trading bot(s) you will need to create some test accounts. In the scripts directory run create_devnet_test_accounts.sh

```shell
cd scripts
./create_devnet_test_accounts.sh
```

This will create two new file system wallets; one for a market maker and one for a taker. You can run either bot or both of them.
There are three scripts for running the bots, from another command line run one of the following:

```shell
./run_maker.sh
```

This will create a market maker which will post orders to the order books listed in config.json. The orders are meant to replicate the corresponding order book currently on mainnet.

```shell
./run_taker.sh
```

This will randomly take from the top of the book.

```shell
./run_maker_taker.sh
```

Finally, you can run both the maker and the taker and have them trade with one another.

After running the bot(s), press CTRL+C to exit. The bot will then cancel any orders it has in the book. This may take a minute or two to complete.


## Monitoring

While running the market making bot it is often useful to be able to inspect the value of the Solana accounts being used. To print out the relevant details you can run the monitor script in the src directory.

```shell
cd src
./monitor.ts
```


## Cranking

If you have orders that are matched a crank will help settle your trade. You can try running the crank yourself by running crank.ts.

```shell
cd src
./crank.ts
```


## References

- This implementation was inspired by [market-maker-ts](https://github.com/blockworks-foundation/market-maker-ts/) from [🥭 Mango Markets](https://mango.markets/).
- An excellent series from Ashpool explaining how to use Serum [How Tf Do You Use Serum Ts Client?](https://ashpoolin.github.io/how-tf-do-you-use-serum-ts-client) and [The Making Of A Market Makerer](https://ashpoolin.github.io/the-making-of-a-market-makerer).
- And the Solana Cookbook examples on [Serum](https://solanacookbook.com/integrations/serum.html) and [Pyth](https://solanacookbook.com/integrations/pyth.html).
- Thank you to Paul Schaaf for the [SPL token faucet](https://github.com/paul-schaaf/spl-token-faucet) and making us all BAZILLIONAIRES on DEVNET!!!
