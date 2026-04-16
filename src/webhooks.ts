/**
 * Pathao Webhook Support
 *
 * Handles incoming webhook events from Pathao.
 *
 * IMPORTANT INTEGRATION DETAILS:
 * - Pathao does NOT sign incoming requests.
 * - Instead, Pathao requires you to prove ownership by echoing your webhook secret
 *   in the \`X-Pathao-Merchant-Webhook-Integration-Secret\` header of EVERY response.
 * - This SDK automatically handles the \`webhook_integration\` handshake event, which
 *   expects a 202 status code and the secret header.
 *
 * @example — Express
 * \`\`\`typescript
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
 * // Mount express.json() BEFORE the webhook middleware
 * app.post(
 *   '/webhooks/pathao',
 *   express.json(),
 *   handler.expressMiddleware(),
 *   (req, res) => {
 *     // The middleware already sets the required secret header.
 *     // You just need to return a 200 OK for standard events.
 *     res.status(200).send('OK');
 *   }
 * );
 * \`\`\`
 */

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
 * Values are the exact strings that appear in the \`event\` field of each payload.
 */
export enum PathaoWebhookEvent {
  WEBHOOK_INTEGRATION = 'webhook_integration',
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_PICKUP_REQUESTED = 'order.pickup-requested',
  ORDER_ASSIGNED_FOR_PICKUP = 'order.assigned-for-pickup',
  ORDER_PICKED = 'order.picked',
  ORDER_PICKUP_FAILED = 'order.pickup-failed',
  ORDER_PICKUP_CANCELLED = 'order.pickup-cancelled',
  ORDER_AT_THE_SORTING_HUB = 'order.at-the-sorting-hub',
  ORDER_IN_TRANSIT = 'order.in-transit',
  ORDER_RECEIVED_AT_LAST_MILE_HUB = 'order.received-at-last-mile-hub',
  ORDER_ASSIGNED_FOR_DELIVERY = 'order.assigned-for-delivery',
  ORDER_DELIVERED = 'order.delivered',
  ORDER_PARTIAL_DELIVERY = 'order.partial-delivery',
  ORDER_RETURNED = 'order.returned',
  ORDER_DELIVERY_FAILED = 'order.delivery-failed',
  ORDER_ON_HOLD = 'order.on-hold',
  ORDER_PAID = 'order.paid',
  ORDER_PAID_RETURN = 'order.paid-return',
  ORDER_EXCHANGED = 'order.exchanged',
  ORDER_RETURN_ID_CREATED = 'order.return-id-created',
  ORDER_RETURN_IN_TRANSIT = 'order.return-in-transit',
  ORDER_RETURNED_TO_MERCHANT = 'order.returned-to-merchant',
  STORE_CREATED = 'store.created',
  STORE_UPDATED = 'store.updated',
}

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface WebhookIntegrationPayload {
  event: PathaoWebhookEvent.WEBHOOK_INTEGRATION;
}

/** Fields present on every normal webhook payload */
export interface BaseWebhookPayload {
  event: string;
  /** Format: MySQL datetime YYYY-MM-DD HH:MM:SS (no timezone indicator) */
  updated_at: string;
  /** Format: ISO 8601 timestamp */
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

/** Shared fields for the three return-journey events */
export interface ReturnOrderWebhookPayload extends BaseWebhookPayload {
  consignment_id: string;
  return_consignment_id: string;
  merchant_order_id?: string;
  store_id: number;
  collected_amount: number;
  return_type: 'return' | 'paid-return' | 'exchange' | 'partial-delivery';
  reason?: string;
}

export interface OrderReturnIdCreatedPayload extends ReturnOrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_RETURN_ID_CREATED;
}

export interface OrderReturnInTransitPayload extends ReturnOrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_RETURN_IN_TRANSIT;
}

export interface OrderReturnedToMerchantPayload extends ReturnOrderWebhookPayload {
  event: PathaoWebhookEvent.ORDER_RETURNED_TO_MERCHANT;
}

export interface StoreCreatedPayload extends StoreWebhookPayload {
  event: PathaoWebhookEvent.STORE_CREATED;
}

export interface StoreUpdatedPayload extends StoreWebhookPayload {
  event: PathaoWebhookEvent.STORE_UPDATED;
}

/** Union of all possible webhook payloads */
export type PathaoWebhookPayload =
  | WebhookIntegrationPayload
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
  | OrderReturnIdCreatedPayload
  | OrderReturnInTransitPayload
  | OrderReturnedToMerchantPayload
  | StoreCreatedPayload
  | StoreUpdatedPayload;

/** Maps each \`PathaoWebhookEvent\` to its specific payload type */
export interface WebhookEventPayloadMap {
  [PathaoWebhookEvent.WEBHOOK_INTEGRATION]: WebhookIntegrationPayload;
  [PathaoWebhookEvent.ORDER_CREATED]: OrderCreatedPayload;
  [PathaoWebhookEvent.ORDER_UPDATED]: OrderUpdatedPayload;
  [PathaoWebhookEvent.ORDER_PICKUP_REQUESTED]: OrderPickupRequestedPayload;
  [PathaoWebhookEvent.ORDER_ASSIGNED_FOR_PICKUP]: OrderAssignedForPickupPayload;
  [PathaoWebhookEvent.ORDER_PICKED]: OrderPickedPayload;
  [PathaoWebhookEvent.ORDER_PICKUP_FAILED]: OrderPickupFailedPayload;
  [PathaoWebhookEvent.ORDER_PICKUP_CANCELLED]: OrderPickupCancelledPayload;
  [PathaoWebhookEvent.ORDER_AT_THE_SORTING_HUB]: OrderAtSortingHubPayload;
  [PathaoWebhookEvent.ORDER_IN_TRANSIT]: OrderInTransitPayload;
  [PathaoWebhookEvent.ORDER_RECEIVED_AT_LAST_MILE_HUB]: OrderAtLastMileHubPayload;
  [PathaoWebhookEvent.ORDER_ASSIGNED_FOR_DELIVERY]: OrderAssignedForDeliveryPayload;
  [PathaoWebhookEvent.ORDER_DELIVERED]: OrderDeliveredPayload;
  [PathaoWebhookEvent.ORDER_PARTIAL_DELIVERY]: OrderPartialDeliveryPayload;
  [PathaoWebhookEvent.ORDER_RETURNED]: OrderReturnedPayload;
  [PathaoWebhookEvent.ORDER_DELIVERY_FAILED]: OrderDeliveryFailedPayload;
  [PathaoWebhookEvent.ORDER_ON_HOLD]: OrderOnHoldPayload;
  [PathaoWebhookEvent.ORDER_PAID]: OrderPaidPayload;
  [PathaoWebhookEvent.ORDER_PAID_RETURN]: OrderPaidReturnPayload;
  [PathaoWebhookEvent.ORDER_EXCHANGED]: OrderExchangedPayload;
  [PathaoWebhookEvent.ORDER_RETURN_ID_CREATED]: OrderReturnIdCreatedPayload;
  [PathaoWebhookEvent.ORDER_RETURN_IN_TRANSIT]: OrderReturnInTransitPayload;
  [PathaoWebhookEvent.ORDER_RETURNED_TO_MERCHANT]: OrderReturnedToMerchantPayload;
  [PathaoWebhookEvent.STORE_CREATED]: StoreCreatedPayload;
  [PathaoWebhookEvent.STORE_UPDATED]: StoreUpdatedPayload;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/** Required response header used to authorize your endpoint with Pathao */
export const PATHAO_SECRET_HEADER =
  'x-pathao-merchant-webhook-integration-secret';

/**
 * Parses the raw body into a webhook payload.
 * Pathao does not sign inbound requests, so this just ensures it is valid JSON with an event field.
 *
 * Throws \`PathaoWebhookError\` on malformed JSON or missing event.
 *
 * @param rawBody       Raw request body or parsed object
 */
export function constructEvent(
  rawBody: Buffer | string | object,
): PathaoWebhookPayload {
  let parsed: unknown;
  if (typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
    parsed = rawBody;
  } else {
    const bodyStr = Buffer.isBuffer(rawBody)
      ? rawBody.toString('utf8')
      : rawBody;
    try {
      parsed = JSON.parse(bodyStr);
    } catch {
      throw new PathaoWebhookError('Webhook payload is not valid JSON.');
    }
  }

  if (!parsed || typeof parsed !== 'object' || !('event' in parsed)) {
    throw new PathaoWebhookError(
      "Webhook payload is missing the required 'event' field.",
    );
  }

  return parsed as PathaoWebhookPayload;
}

// ---------------------------------------------------------------------------
// PathaoWebhookHandler
// ---------------------------------------------------------------------------

export type WebhookResponseInstructions = {
  statusCode: number;
  headers: Record<string, string>;
  payload: PathaoWebhookPayload | null;
  error: PathaoWebhookError | null;
};

/**
 * Stateful webhook handler that parses payloads, provides response instructions,
 * and dispatches events to typed listeners.
 *
 * @example
 * \`\`\`typescript
 * const handler = new PathaoWebhookHandler(process.env.PATHAO_WEBHOOK_SECRET!);
 *
 * handler.on(PathaoWebhookEvent.ORDER_DELIVERED, (payload) => {
 *   // payload is fully typed as OrderDeliveredPayload
 *   console.log(payload.consignment_id, payload.collected_amount);
 * });
 * \`\`\`
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
  /** Fires for every successfully parsed event regardless of type. */
  on(event: 'webhook', listener: (payload: PathaoWebhookPayload) => void): this;
  /** Fires when parsing fails. */
  on(event: 'error', listener: (error: PathaoWebhookError) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  /** Listen once for a specific Pathao event. */
  once<E extends PathaoWebhookEvent>(
    event: E,
    listener: (payload: WebhookEventPayloadMap[E]) => void,
  ): this;
  once(
    event: 'webhook',
    listener: (payload: PathaoWebhookPayload) => void,
  ): this;
  once(event: 'error', listener: (error: PathaoWebhookError) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Parse the body and dispatch the event.
   *
   * Throws \`PathaoWebhookError\` on failure and also emits \`'error'\` so
   * listeners can respond without a try/catch.
   *
   * @param rawBody  Raw request body or matched json object
   */
  process(rawBody: Buffer | string | object): PathaoWebhookPayload {
    let payload: PathaoWebhookPayload;

    try {
      payload = constructEvent(rawBody);
    } catch (err) {
      const webhookErr =
        err instanceof PathaoWebhookError
          ? err
          : new PathaoWebhookError(
            err instanceof Error ? err.message : 'Unknown error',
          );
      if (this.listenerCount('error') > 0) {
        this.emit('error', webhookErr);
      }
      throw webhookErr;
    }

    this.emit(payload.event, payload);
    this.emit('webhook', payload);

    return payload;
  }

  /**
   * Returns an Express-compatible middleware function.
   *
   * Automatically sets the required \`X-Pathao-Merchant-Webhook-Integration-Secret\` header.
   * Automatically responds with 202 for the \`webhook_integration\` handshake.
   * For standard events, attaches the payload to \`req.pathaoWebhook\` and calls \`next()\`.
   * On error, calls \`next(err)\`.
   *
   * \`\`\`typescript
   * app.post(
   *   '/webhooks/pathao',
   *   express.json(),
   *   handler.expressMiddleware(),
   *   (req, res) => res.sendStatus(200) // You must send 200 for other events
   * );
   * \`\`\`
   */
  expressMiddleware() {
    return (
      req: {
        body: Buffer | string | object;
        pathaoWebhook?: PathaoWebhookPayload;
      },
      res: {
        setHeader: (name: string, value: string) => void;
        status: (code: number) => { send: () => void };
      },
      next: (err?: unknown) => void,
    ): void => {
      try {
        res.setHeader(PATHAO_SECRET_HEADER, this.webhookSecret);

        const payload = this.process(req.body);
        req.pathaoWebhook = payload;

        if (payload.event === PathaoWebhookEvent.WEBHOOK_INTEGRATION) {
          res.status(202).send();
          return;
        }

        next();
      } catch (err) {
        next(err);
      }
    };
  }

  /**
   * Returns response instructions for any framework (Fastify, Hono, etc.).
   *
   * Never throws — always resolves with a \`WebhookResponseInstructions\` object
   * that tells you which status code and headers to return, along with the payload/error.
   *
   * \`\`\`typescript
   * const handle = handler.middleware();
   * const instructions = await handle(request.body);
   *
   * // Apply the required headers (the secret header)
   * for (const [key, value] of Object.entries(instructions.headers)) {
   *   reply.header(key, value);
   * }
   *
   * if (instructions.error) {
   *   return reply.status(instructions.statusCode).send({ error: instructions.error.message });
   * }
   *
   * // If it was the handshake, we should just return 202 as instructed
   * if (instructions.payload?.event === 'webhook_integration') {
   *   return reply.status(instructions.statusCode).send();
   * }
   *
   * // Process your real webhook
   * return reply.status(instructions.statusCode).send({ received: true });
   * \`\`\`
   */
  middleware() {
    return async (
      rawBody: Buffer | string | object,
    ): Promise<WebhookResponseInstructions> => {
      const headers = { [PATHAO_SECRET_HEADER]: this.webhookSecret };

      try {
        const payload = this.process(rawBody);
        const isHandshake =
          payload.event === PathaoWebhookEvent.WEBHOOK_INTEGRATION;
        return {
          statusCode: isHandshake ? 202 : 200,
          headers,
          payload,
          error: null,
        };
      } catch (err) {
        const webhookErr =
          err instanceof PathaoWebhookError
            ? err
            : new PathaoWebhookError(
              err instanceof Error ? err.message : 'Unknown error',
            );
        return {
          statusCode: 400,
          headers,
          payload: null,
          error: webhookErr,
        };
      }
    };
  }
}
