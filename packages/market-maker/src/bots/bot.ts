//TODO load this from a package.
import { Order, Protocol } from '../../../bot-sdk/src/';

export abstract class Bot {
  protocol: Protocol;

  constructor(protocol: Protocol) {
    this.protocol = protocol;
  }

  abstract process(): Promise<void>;

  sendOrders(orders: Order[]): void {
    if (this.protocol) {
      this.protocol.sendOrders(orders);
    }
  }
}
