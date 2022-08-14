import { Market } from '@project-serum/serum';

export interface SpotOrder {
  marketConfig: any;
  market: Market;
  side: 'buy' | 'sell';
  price: number;
  size: number;
  orderType?: 'limit' | 'ioc' | 'postOnly';
  selfTradeBehavior:
    | 'decrementTake'
    | 'cancelProvide'
    | 'abortTransaction'
    | undefined;
}
