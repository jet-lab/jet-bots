# Solana Trading









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
