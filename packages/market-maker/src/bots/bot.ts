import { Order, Protocol } from '@jet-lab/bot-sdk';

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
