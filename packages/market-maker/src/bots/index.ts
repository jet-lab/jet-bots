import { Bot, Context } from '../context';
import { Maker } from './maker';
import { Taker } from './taker';

export function createBot(context: Context, type: string): Bot {
  switch (type) {
    case 'maker':
      return new Maker(context);
    case 'taker':
      return new Taker(context);
    default: {
      console.log(`Unhandled bot type: ${type}`);
      process.exit();
    }
  }
}
