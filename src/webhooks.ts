/**
 * Pathao Webhook Support
 *
 * Handles incoming webhook events from Pathao.
 *
 * IMPORTANT: The official Pathao API documentation does not describe a webhook
 * specification. This implementation is based on observed webhook behaviour and
 * community research. Treat it as best-effort until Pathao publishes official
 * webhook docs.
 *
 * Signature mechanism: Pathao sends the raw shared secret in the
 * `X-PATHAO-Signature` header. There is no HMAC — the header value IS the
 * secret. A constant-time comparison is used to prevent timing attacks.
 *
 * @example — framework-agnostic
 * ```typescript
 * import {
 *   PathaoWebhookHandler,
 *   PathaoWebhookEvent,
 * } from 'pathao-merchant-sdk/webhooks';
 *
 * const handler = new PathaoWebhookHandler(process.env.PATHAO_WEBHOOK_SECRET!);
 *
 * handler.on(PathaoWebhookEvent.ORDER_DELIVERED, (payload) => {
 *   console.log(payload.consignment_id, payload.collected_amount);
 * });
 *
 * // In your HTTP server — raw body as Buffer/string required:
 * const event = handler.process(rawBody, req.headers);
 * res.status(200).json({ received: true });
 * ```
 *
 * @example — Express
 * ```typescript
 * import express from 'express';
 * import {
 *   PathaoWebhookHandler,
 *   PathaoWebhookEvent,
 * } from 'pathao-merchant-sdk/webhooks';
 *
 * const app = express();
 * const handler = new PathaoWebhookHandler(process.env.PATHAO_WEBHOOK_SECRET!);
 *
 * handler.on(PathaoWebhookEvent.ORDER_DELIVERED, (payload) => { ... });
 *
 * // Mount express.raw() BEFORE the webhook middleware
 * app.post(
 *   '/webhooks/pathao',
 *   express.raw({ type: 'application/json' }),
 *   handler.expressMiddleware(),
 * );
 * ```
 */

import { timingSafeEqual } from 'crypto';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class PathaoWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PathaoWebhookError';
  }
}

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/**
 * All webhook event types emitted by Pathao.
 * Values are the exact strings that appear in the `event` field of each payload.
 */
export enum PathaoWebhookEvent {
  ORDER_CREATED                   = 'order.created',
  ORDER_UPDATED                   = 'order.updated',
  ORDER_PICKUP_REQUESTED          = 'order.pickup-requested',
  ORDER_ASSIGNED_FOR_PICKUP       = 'order.assigned-for-pickup',
  ORDER_PICKED                    = 'order.picked',
  ORDER_PICKUP_FAILED             = 'order.pickup-failed',
  ORDER_PICKUP_CANCELLED          = 'order.pickup-cancelled',
  ORDER_AT_THE_SORTING_HUB        = 'order.at-the-sorting-hub',
  ORDER_IN_TRANSIT                = 'order.in-transit',
  ORDER_RECEIVED_AT_LAST_MILE_HUB = 'order.received-at-last-mile-hub',
  ORDER_ASSIGNED_FOR_DELIVERY     = 'order.assigned-for-delivery',
  ORDER_DELIVERED                 = 'order.delivered',
  ORDER_PARTIAL_DELIVERY          = 'order.partial-delivery',
  ORDER_RETURNED                  = 'order.returned',
  ORDER_DELIVERY_FAILED           = 'order.delivery-failed',
  ORDER_ON_HOLD                   = 'order.on-hold',
  ORDER_PAID                      = 'order.paid',
  ORDER_PAID_RETURN               = 'order.paid-return',
  ORDER_EXCHANGED                 = 'order.exchanged',
  STORE_CREATED                   = 'store.created',
  STORE_UPDATED                   = 'store.updated',
}

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

/** Fields present on every webhook payload */
export interface BaseWebhookPayload {
  /** Dot-notation event type — matches a `PathaoWebhookEvent` value */
  event: string;
  /** ISO timestamp of when the state change occurred */
  updated_at: string;
  /** ISO timestamp of when this webhook was dispatched */
  timestamp: string;
}

/** Fields shared by all order-related events */
export interface OrderWebhookPayload extends BaseWebhookPayload {
  consignment_id: string;
  merchant_order_id?: string;
  store_id: number;
  delivery_fee?: number;
}

/** Fields shared by all store-related events */
export interface StoreWebhookPayload extends BaseWebhookPayload {
  store_id: number;
  store_name: string;
  store_address: string;
  is_active: 0 | 1;
}

// Per-event payload types ────────────────────────────────────────────────────

export interface OrderCreatedPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_CREATED;
  delivery_fee: number;
}

export interface OrderUpdatedPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_UPDATED;
  delivery_fee: number;
}

export interface OrderPickupRequestedPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_PICKUP_REQUESTED;
  delivery_fee: number;
}

export interface OrderAssignedForPickupPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_ASSIGNED_FOR_PICKUP;
}

export interface OrderPickedPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_PICKED;
}

export interface OrderPickupFailedPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_PICKUP_FAILED;
}

export interface OrderPickupCancelledPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_PICKUP_CANCELLED;
}

export interface OrderAtSortingHubPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_AT_THE_SORTING_HUB;
}

export interface OrderInTransitPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_IN_TRANSIT;
}

export interface OrderAtLastMileHubPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_RECEIVED_AT_LAST_MILE_HUB;
}

export interface OrderAssignedForDeliveryPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_ASSIGNED_FOR_DELIVERY;
}

export interface OrderDeliveredPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_DELIVERED;
  collected_amount: number;
}

export interface OrderPartialDeliveryPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_PARTIAL_DELIVERY;
  collected_amount: number;
  reason?: string;
}

export interface OrderReturnedPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_RETURNED;
  reason?: string;
}

export interface OrderDeliveryFailedPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_DELIVERY_FAILED;
  reason?: string;
}

export interface OrderOnHoldPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_ON_HOLD;
  reason?: string;
}

export interface OrderPaidPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_PAID;
  invoice_id: string;
}

export interface OrderPaidReturnPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_PAID_RETURN;
  collected_amount: number;
  reason?: string;
}

export interface OrderExchangedPayload extends OrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_EXCHANGED;
  collected_amount: number;
  reason?: string;
}

export interface StoreCreatedPayload extends StoreWebhookPayload {
  event: PathaoWebhookEvent.STORE_CREATED;
}

export interface StoreUpdatedPayload extends StoreWebhookPayload {
  event: PathaoWebhookEvent.STORE_UPDATED;
}

/** Union of all possible webhook payloads */
export type PathaoWebhookPayload =
  | OrderCreatedPayload
  | OrderUpdatedPayload
  | OrderPickupRequestedPayload
  | OrderAssignedForPickupPayload
  | OrderPickedPayload
  | OrderPickupFailedPayload
  | OrderPickupCancelledPayload
  | OrderAtSortingHubPayload
  | OrderInTransitPayload
  | OrderAtLastMileHubPayload
  | OrderAssignedForDeliveryPayload
  | OrderDeliveredPayload
  | OrderPartialDeliveryPayload
  | OrderReturnedPayload
  | OrderDeliveryFailedPayload
  | OrderOnHoldPayload
  | OrderPaidPayload
  | OrderPaidReturnPayload
  | OrderExchangedPayload
  | StoreCreatedPayload
  | StoreUpdatedPayload;

/** Maps each `PathaoWebhookEvent` to its specific payload type */
export interface WebhookEventPayloadMap {
  [PathaoWebhookEvent.ORDER_CREATED]:                   OrderCreatedPayload;
  [PathaoWebhookEvent.ORDER_UPDATED]:                   OrderUpdatedPayload;
  [PathaoWebhookEvent.ORDER_PICKUP_REQUESTED]:          OrderPickupRequestedPayload;
  [PathaoWebhookEvent.ORDER_ASSIGNED_FOR_PICKUP]:       OrderAssignedForPickupPayload;
  [PathaoWebhookEvent.ORDER_PICKED]:                    OrderPickedPayload;
  [PathaoWebhookEvent.ORDER_PICKUP_FAILED]:             OrderPickupFailedPayload;
  [PathaoWebhookEvent.ORDER_PICKUP_CANCELLED]:          OrderPickupCancelledPayload;
  [PathaoWebhookEvent.ORDER_AT_THE_SORTING_HUB]:        OrderAtSortingHubPayload;
  [PathaoWebhookEvent.ORDER_IN_TRANSIT]:                OrderInTransitPayload;
  [PathaoWebhookEvent.ORDER_RECEIVED_AT_LAST_MILE_HUB]: OrderAtLastMileHubPayload;
  [PathaoWebhookEvent.ORDER_ASSIGNED_FOR_DELIVERY]:     OrderAssignedForDeliveryPayload;
  [PathaoWebhookEvent.ORDER_DELIVERED]:                 OrderDeliveredPayload;
  [PathaoWebhookEvent.ORDER_PARTIAL_DELIVERY]:          OrderPartialDeliveryPayload;
  [PathaoWebhookEvent.ORDER_RETURNED]:                  OrderReturnedPayload;
  [PathaoWebhookEvent.ORDER_DELIVERY_FAILED]:           OrderDeliveryFailedPayload;
  [PathaoWebhookEvent.ORDER_ON_HOLD]:                   OrderOnHoldPayload;
  [PathaoWebhookEvent.ORDER_PAID]:                      OrderPaidPayload;
  [PathaoWebhookEvent.ORDER_PAID_RETURN]:               OrderPaidReturnPayload;
  [PathaoWebhookEvent.ORDER_EXCHANGED]:                 OrderExchangedPayload;
  [PathaoWebhookEvent.STORE_CREATED]:                   StoreCreatedPayload;
  [PathaoWebhookEvent.STORE_UPDATED]:                   StoreUpdatedPayload;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/** Signature header name sent by Pathao on every webhook request */
export const PATHAO_SIGNATURE_HEADER = 'x-pathao-signature';

/**
 * Verify the `X-PATHAO-Signature` header against the configured webhook secret.
 *
 * Uses a constant-time comparison to prevent timing attacks. The header value
 * is the raw shared secret — Pathao does not hash the signature.
 *
 * @returns `true` if valid, `false` if missing or mismatched.
 */
export function verifySignature(
  signature: string | undefined,
  webhookSecret: string,
): boolean {
  if (!signature || !webhookSecret) return false;

  try {
    const sigBuf    = Buffer.from(signature,     'utf8');
    const secretBuf = Buffer.from(webhookSecret, 'utf8');
    if (sigBuf.length !== secretBuf.length) return false;
    return timingSafeEqual(sigBuf, secretBuf);
  } catch {
    return false;
  }
}

/**
 * Verify the webhook signature and parse the raw body in one step.
 *
 * Throws `PathaoWebhookError` on signature failure or malformed JSON.
 *
 * @param rawBody       Raw request body — do NOT pre-parse with `JSON.parse`
 * @param headers       Request headers object
 * @param webhookSecret Your Pathao webhook integration secret
 */
export function constructEvent(
  rawBody: Buffer | string,
  headers: Record<string, string | string[] | undefined>,
  webhookSecret: string,
): PathaoWebhookPayload {
  const signature = extractHeader(headers, PATHAO_SIGNATURE_HEADER);

  if (!signature) {
    throw new PathaoWebhookError(
      `Missing ${PATHAO_SIGNATURE_HEADER} header. ` +
      'Ensure Pathao is sending the signature.',
    );
  }

  if (!verifySignature(signature, webhookSecret)) {
    throw new PathaoWebhookError(
      'Invalid webhook signature. ' +
      'Check that your webhookSecret matches the Pathao integration secret.',
    );
  }

  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyStr);
  } catch {
    throw new PathaoWebhookError('Webhook payload is not valid JSON.');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('event' in parsed)
  ) {
    throw new PathaoWebhookError(
      'Webhook payload is missing the required `event` field.',
    );
  }

  return parsed as PathaoWebhookPayload;
}

// ---------------------------------------------------------------------------
// PathaoWebhookHandler
// ---------------------------------------------------------------------------

type GenericHeaders = Record<string, string | string[] | undefined>;

/**
 * Stateful webhook handler that verifies incoming requests, parses payloads,
 * and dispatches events to typed listeners.
 *
 * @example
 * ```typescript
 * const handler = new PathaoWebhookHandler(process.env.PATHAO_WEBHOOK_SECRET!);
 *
 * handler.on(PathaoWebhookEvent.ORDER_DELIVERED, (payload) => {
 *   // payload is fully typed as OrderDeliveredPayload
 *   console.log(payload.consignment_id, payload.collected_amount);
 * });
 * ```
 */
export class PathaoWebhookHandler extends EventEmitter {
  private readonly webhookSecret: string;

  constructor(webhookSecret: string) {
    super();
    if (!webhookSecret) {
      throw new PathaoWebhookError(
        'webhookSecret is required to create a PathaoWebhookHandler.',
      );
    }
    this.webhookSecret = webhookSecret;
  }

  // Typed on() overloads ──────────────────────────────────────────────────

  /** Listen for a specific Pathao event with a fully-typed payload callback. */
  on<E extends PathaoWebhookEvent>(
    event: E,
    listener: (payload: WebhookEventPayloadMap[E]) => void,
  ): this;
  /** Fires for every successfully verified event regardless of type. */
  on(event: 'webhook', listener: (payload: PathaoWebhookPayload) => void): this;
  /** Fires when verification or parsing fails. */
  on(event: 'error', listener: (error: PathaoWebhookError) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verify the signature, parse the body, and dispatch the event.
   *
   * Throws `PathaoWebhookError` on failure and also emits `'error'` so
   * listeners can respond without a try/catch.
   *
   * @param rawBody  Raw request body — must NOT be pre-parsed
   * @param headers  HTTP request headers
   */
  process(rawBody: Buffer | string, headers: GenericHeaders): PathaoWebhookPayload {
    let payload: PathaoWebhookPayload;

    try {
      payload = constructEvent(rawBody, headers, this.webhookSecret);
    } catch (err) {
      const webhookErr = err instanceof PathaoWebhookError
        ? err
        : new PathaoWebhookError(err instanceof Error ? err.message : 'Unknown error');
      this.emit('error', webhookErr);
      throw webhookErr;
    }

    this.emit(payload.event, payload);
    this.emit('webhook', payload);

    return payload;
  }

  /**
   * Returns an Express-compatible middleware function.
   *
   * **Requires** `express.raw({ type: 'application/json' })` mounted on the
   * same route before this middleware so the raw body Buffer is preserved.
   *
   * On success the parsed payload is attached to `req.pathaoWebhook`.
   * On failure a `400` response is returned.
   *
   * ```typescript
   * app.post(
   *   '/webhooks/pathao',
   *   express.raw({ type: 'application/json' }),
   *   handler.expressMiddleware(),
   * );
   * ```
   */
  expressMiddleware() {
    return (
      req: {
        body: Buffer | string;
        headers: GenericHeaders;
        pathaoWebhook?: PathaoWebhookPayload;
      },
      res: { status: (code: number) => { json: (body: unknown) => void } },
      next: (err?: unknown) => void,
    ): void => {
      try {
        req.pathaoWebhook = this.process(req.body, req.headers);
        next();
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Webhook processing failed',
        });
      }
    };
  }

  /**
   * Returns a generic async handler for any framework (Fastify, Hono, plain
   * `http.createServer`, etc.).
   *
   * Never rejects — always resolves with either `{ payload, error: null }` or
   * `{ payload: null, error: PathaoWebhookError }`.
   *
   * ```typescript
   * const handle = handler.middleware();
   * const { payload, error } = await handle(rawBody, request.headers);
   * if (error) { reply.status(400).send({ error: error.message }); return; }
   * reply.send({ received: true });
   * ```
   */
  middleware() {
    return async (
      rawBody: Buffer | string,
      headers: GenericHeaders,
    ): Promise<
      | { payload: PathaoWebhookPayload; error: null }
      | { payload: null; error: PathaoWebhookError }
    > => {
      try {
        const payload = this.process(rawBody, headers);
        return { payload, error: null };
      } catch (err) {
        const webhookErr = err instanceof PathaoWebhookError
          ? err
          : new PathaoWebhookError(
            err instanceof Error ? err.message : 'Unknown error',
          );
        return { payload: null, error: webhookErr };
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a single-value header, case-insensitively */
function extractHeader(
  headers: GenericHeaders,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find(k => k.toLowerCase() === lower);
  if (!key) return undefined;
  const value = headers[key];
  if (Array.isArray(value)) return value[0];
  return value;
}
