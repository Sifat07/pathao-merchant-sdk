/**
 * Pathao Merchant API SDK (Unofficial)
 * 
 * An unofficial TypeScript SDK for integrating with the Pathao Merchant API.
 * 
 * @example
 * ```typescript
 * import { PathaoApiService, DeliveryType, ItemType } from '@sifat07/pathao-merchant-sdk';
 * 
 * const pathao = new PathaoApiService({
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   username: 'your-username',
 *   password: 'your-password'
 * });
 * 
 * // Create an order
 * const order = await pathao.createOrder({
 *   store_id: 123,
 *   recipient_name: 'John Doe',
 *   recipient_phone: '01712345678',
 *   recipient_address: '123 Main Street, Dhanmondi',
 *   delivery_type: DeliveryType.NORMAL,
 *   item_type: ItemType.PARCEL,
 *   item_quantity: 1,
 *   item_weight: 1.0,
 *   amount_to_collect: 500
 * });
 * ```
 */

export { PathaoApiService } from './pathao-api';

export type {
  PathaoConfig,
  PathaoAuthResponse,
  PathaoOrderRequest,
  PathaoOrderResponse,
  PathaoStoreRequest,
  PathaoStoreResponse,
  PathaoPriceRequest,
  PathaoPriceResponse,
  PathaoCityResponse,
  PathaoOrderStatusResponse,
  PathaoAreaResponse,
  PathaoZoneResponse,
  PathaoError,
} from './types';

export {
  DeliveryType,
  ItemType,
} from './types';

// Re-export everything for convenience
export * from './types';
export * from './pathao-api';
