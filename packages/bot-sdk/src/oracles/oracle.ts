import { OracleConfiguration } from '../configuration';

export abstract class Oracle {
  oracleConfig: OracleConfiguration;

  constructor(oracleConfig: OracleConfiguration) {
    this.oracleConfig = oracleConfig;
  }

  abstract listen(): Promise<void>;
}
