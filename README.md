<div align="center">
  <img height="170" src="https://293354890-files.gitbook.io/~/files/v0/b/gitbook-legacy-files/o/assets%2F-M_72skN1dye71puMdjs%2F-Miqzl5oK1cXXAkARfER%2F-Mis-yeKp1Krh7JOFzQG%2Fjet_logomark_color.png?alt=media&token=0b8dfc84-37d7-455d-9dfd-7bb59cee5a1a" />

  <h1>jet-bots</h1>

  <p>
    <strong>Jet Bots Monorepo</strong>
  </p>

  <p>
    <a target="_blank" href="https://opensource.org/licenses/AGPL-3.0">
      <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0--or--later-blue" />
    </a>
  </p>

  <h4>
    <a href="https://jetprotocol.io/">Website</a>
    <span> | </span>
    <a href="https://github.com/jet-lab/jet-bots">GitHub Repo</a>
  </h4>
</div>

## Packages

| Package                                             | Version                                                                                                                   | Description                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`@jet-lab/bot-sdk`](/packages/bot-sdk)           | [![npm](https://img.shields.io/npm/v/@jet-lab/bot-sdk.svg)](https://www.npmjs.com/package@jet-lab/bot-sdk)           | Bot SDK |
| [`@jet-lab/market-maker`](/packages/market-maker)           | [![npm](https://img.shields.io/npm/v/@jet-lab/market-maker.svg)](https://www.npmjs.com/package@jet-lab/market-maker)           | Market Maker |
| [`@jet-lab/simulation`](/packages/simulation)           | [![npm](https://img.shields.io/npm/v/@jet-lab/simulation.svg)](https://www.npmjs.com/package/@jet-lab/simulation)           | Simulation |

## Contributing

### Installing

To get started first install the required build tools:

```
npm install -g lerna
npm install -g yarn
```

Then bootstrap the workspace:

```
yarn
```

### Building

To build the workspace:

```
yarn build
```

### Testing

> If this is the first test, set up local devnet accounts (maker and taker accounts) before running test script.

```
bash ./packages/market-maker/scripts/create_devnet_accounts.sh
```

To run all tests:

```
yarn test
```

### Linting

To lint:

```
yarn lint
```

To apply lint fixes:

```
yarn lint:fix
```
