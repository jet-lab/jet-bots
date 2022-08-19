//TODO load this from a package.
import { MarginAccount, Order } from '../../../bot-sdk/src/';

export abstract class Bot {
  marginAccount: MarginAccount;

  constructor(marginAccount: MarginAccount) {
    this.marginAccount = marginAccount;
  }

  abstract process(): Promise<void>;

  sendOrders(orders: Order[]): void {
    if (this.marginAccount) {
      this.marginAccount.sendOrders(orders);
    }
  }
}
