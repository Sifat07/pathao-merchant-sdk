/**
 * Shared order lifecycle for Pathao webhook events and order-status slugs.
 *
 * Both describe the same parcel journey. `toLifecycleStatus` maps either one
 * to a small stable vocabulary, so consumers don't each keep a map of spelling
 * variants ("Pickup Requested", "pickup-requested", "order.pickup-requested").
 * Zero dependencies: safe to import from the webhooks entry point.
 */

export type PathaoLifecycleStatus =
  | 'created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'partial'
  | 'on_hold'
  /** On its way back. Not back yet: don't restock on this. */
  | 'returning'
  /** Back with the merchant. */
  | 'returned'
  | 'cancelled';

/** Pathao's gateway allows 60 requests per rolling minute, with no Retry-After on its 429. */
export const PATHAO_RATE_LIMIT_PER_MINUTE = 60;

/** getOrderStatus only finds orders for roughly this many days after creation. */
export const PATHAO_STATUS_RETENTION_DAYS = 90;

// Keys are webhook event names without "order.", plus the kebab-cased status
// labels Pathao uses elsewhere: order_status_slug values seen in production
// ("Pending", "In Transit", "Return") and the labels in Pathao's own
// WooCommerce plugin ("Order_Created", "Return", "exchange").
const LIFECYCLE: Readonly<Record<string, PathaoLifecycleStatus>> = {
  'pending': 'created',
  'created': 'created',
  'order-created': 'created',
  'pickup-requested': 'created',
  'assigned-for-pickup': 'created',
  'picked': 'picked_up',
  'pickup-failed': 'on_hold',
  'pickup-cancelled': 'cancelled',
  'at-the-sorting-hub': 'in_transit',
  'in-transit': 'in_transit',
  'received-at-last-mile-hub': 'in_transit',
  'assigned-for-delivery': 'out_for_delivery',
  'delivered': 'delivered',
  'partial-delivery': 'partial',
  'delivery-failed': 'on_hold',
  'on-hold': 'on_hold',
  // Marked for return; the parcel only comes back with returned-to-merchant.
  'returned': 'returning',
  'return': 'returning',
  'return-id-created': 'returning',
  'return-in-transit': 'returning',
  'paid-return': 'returning',
  'exchanged': 'returning',
  'exchange': 'returning',
  'returned-to-merchant': 'returned',
};

/**
 * Map a webhook event (`order.delivered`) or an order-status slug / display
 * string (`Pickup Requested`, `pickup_requested`) to a lifecycle status.
 * Returns `'unknown'` for anything that isn't a lifecycle change
 * (`order.updated`, `order.paid`, store events) or that this SDK hasn't seen.
 */
export function toLifecycleStatus(value: string): PathaoLifecycleStatus | 'unknown' {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/^order\./, '')
    .replace(/[\s_]+/g, '-');
  return LIFECYCLE[key] ?? 'unknown';
}

/** Delivered, partially delivered, back with the merchant, or cancelled. */
export function isFinalLifecycleStatus(status: PathaoLifecycleStatus | 'unknown'): boolean {
  return status === 'delivered' || status === 'partial' || status === 'returned' || status === 'cancelled';
}
