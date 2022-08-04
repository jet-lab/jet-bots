import * as fs from 'fs';

import ConfigurationBuilder from './configurationBuilder';

(async () => {

  const configurationBuilder = new ConfigurationBuilder(require('./instruments.json'), require('./config.json'));
  const [ configuration_public, configuration_private ] = await configurationBuilder.build();

  fs.writeFileSync('./src/config.json', JSON.stringify(configuration_private, null, 2));
  fs.writeFileSync('../bot/src/config.json', JSON.stringify(configuration_public, null, 2));

})();
