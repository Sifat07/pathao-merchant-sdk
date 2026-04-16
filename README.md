# Pathao Merchant SDK

[![npm version](https://img.shields.io/npm/v/pathao-merchant-sdk.svg)](https://www.npmjs.com/package/pathao-merchant-sdk)
[![npm downloads](https://img.shields.io/npm/dm/pathao-merchant-sdk.svg)](https://www.npmjs.com/package/pathao-merchant-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/sifat07/pathao-merchant-sdk/ci.yml?branch=main)](https://github.com/sifat07/pathao-merchant-sdk/actions)

An **unofficial** TypeScript SDK for the [Pathao Courier Merchant API](https://merchant.pathao.com/developer). Provides a type-safe interface for order management, store management, price calculation, location lookup, and webhook handling.

> **Disclaimer:** This is a community-maintained package, not an official Pathao product. It is not affiliated with or endorsed by Pathao.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
  - [Order Management](#order-management)
  - [Bulk Orders](#bulk-orders)
  - [Store Management](#store-management)
  - [Price Calculation](#price-calculation)
  - [Location Services](#location-services)
  - [Validation Helpers](#validation-helpers)
- [Error Handling](#error-handling)
- [Webhooks](#webhooks)
- [TypeScript Types](#typescript-types)
- [Contributing](#contributing)
- [License](#license)
- [Changelog](#changelog)

---

## Requirements

- Node.js >= 18
- TypeScript >= 4.9 (peer dependency)

## Installation

```bash
npm install pathao-merchant-sdk
# or
yarn add pathao-merchant-sdk
# or
pnpm add pathao-merchant-sdk
```

## Quick Start

Use the sandbox credentials below to get started immediately. For production, get your credentials from the [Pathao Merchant Dashboard](https://merchant.pathao.com/developer) under **API Credentials**.

**Sandbox credentials (publicly provided by Pathao for testing):**

| Field          | Value                                      |
| -------------- | ------------------------------------------ |
| `baseURL`      | `https://courier-api-sandbox.pathao.com`   |
| `clientId`     | `7N1aMJQbWm`                               |
| `clientSecret` | `wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39` |
| `username`     | `test@pathao.com`                          |
| `password`     | `lovePathao`                               |

```typescript
import { PathaoApiService, DeliveryType, ItemType } from "pathao-merchant-sdk";

const pathao = PathaoApiService.fromConfig({
  baseURL: "https://courier-api-sandbox.pathao.com",
  clientId: "7N1aMJQbWm",
  clientSecret: "wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39",
  username: "test@pathao.com",
  password: "lovePathao",
});

const order = await pathao.createOrder({
  store_id: 12345,
  recipient_name: "John Doe",
  recipient_phone: "01712345678",
  recipient_address: "House 10, Road 5, Dhanmondi, Dhaka",
  delivery_type: DeliveryType.NORMAL,
  item_type: ItemType.PARCEL,
  item_quantity: 1,
  item_weight: 0.5,
  amount_to_collect: 500,
});

console.log("Consignment ID:", order.data.consignment_id);
```

---

## Configuration

### Environments

|             | Sandbox                                  | Production                      |
| ----------- | ---------------------------------------- | ------------------------------- |
| `baseURL`   | `https://courier-api-sandbox.pathao.com` | `https://api-hermes.pathao.com` |
| Credentials | From merchant dashboard (sandbox tab)    | From merchant dashboard         |

Obtain your `client_id`, `client_secret`, username, and password from the **API Credentials** section of the [Pathao Merchant Dashboard](https://merchant.pathao.com/developer).

### Environment Variables

Copy `env.example` to `.env`:

```bash
cp env.example .env
```

```env
# Choose one:
PATHAO_BASE_URL=https://courier-api-sandbox.pathao.com
# PATHAO_BASE_URL=https://api-hermes.pathao.com

PATHAO_CLIENT_ID=your-client-id
PATHAO_CLIENT_SECRET=your-client-secret
PATHAO_USERNAME=your-username
PATHAO_PASSWORD=your-password

# Optional
PATHAO_TIMEOUT=30000
```

If you use `dotenv`, load it before initializing the SDK:

```typescript
import "dotenv/config";
```

### Factory Methods

```typescript
// From environment variables
const pathao = PathaoApiService.fromEnv();

// From environment with options
const pathao = PathaoApiService.fromEnv({
  debug: true,
  circuitBreaker: { threshold: 10, timeout: 120_000 },
});

// From explicit config
const pathao = PathaoApiService.fromConfig({
  baseURL: "https://api-hermes.pathao.com",
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  username: "your-username",
  password: "your-password",
});

// Named constructors (pre-fill the base URL)
const pathao = PathaoApiService.sandbox({
  clientId,
  clientSecret,
  username,
  password,
});
const pathao = PathaoApiService.production({
  clientId,
  clientSecret,
  username,
  password,
});
```

### Options

```typescript
const pathao = new PathaoApiService(config, {
  debug: false, // Log all HTTP requests/responses (default: false)
  circuitBreaker: {
    threshold: 5, // Failures before opening circuit (default: 5)
    timeout: 60_000, // Ms before attempting to close circuit (default: 60000)
  },
});
```

Configuration validation is **deferred** to the first API call — constructing the SDK never throws.

---

## API Reference

### Order Management

#### Create Order

```typescript
const order = await pathao.createOrder({
  store_id: 12345, // Required — your store ID
  merchant_order_id: "ORDER-001", // Optional — your internal tracking ID
  recipient_name: "John Doe", // Required — 3–100 characters
  recipient_phone: "01712345678", // Required — 11 digits, starts with 01
  recipient_secondary_phone: "01812345678", // Optional
  recipient_address: "House 10, Road 5, Dhanmondi, Dhaka", // Required — 10–220 chars
  recipient_city: 1, // Optional — auto-detected if omitted
  recipient_zone: 1, // Optional — auto-detected if omitted
  recipient_area: 1, // Optional — auto-detected if omitted
  delivery_type: DeliveryType.NORMAL, // Required — NORMAL (48) or ON_DEMAND (12)
  item_type: ItemType.PARCEL, // Required — DOCUMENT (1) or PARCEL (2)
  item_quantity: 1, // Required
  item_weight: 0.5, // Required — 0.5–10 kg
  item_description: "Cotton shirt", // Optional
  special_instruction: "Call before delivery", // Optional
  amount_to_collect: 500, // Required — COD amount; 0 for prepaid
});

// Response
console.log(order.data.consignment_id); // Pathao tracking ID
console.log(order.data.merchant_order_id);
console.log(order.data.order_status); // "Pending"
console.log(order.data.delivery_fee); // number
```

#### Get Order Status

```typescript
const info = await pathao.getOrderStatus("DL121224VS8TTJ");

console.log(info.data.consignment_id);
console.log(info.data.order_status);
console.log(info.data.order_status_slug);
console.log(info.data.updated_at); // "YYYY-MM-DD HH:MM:SS"
console.log(info.data.invoice_id); // string | null
```

### Bulk Orders

```typescript
const result = await pathao.createBulkOrder([
  {
    store_id: 12345,
    recipient_name: "Alice",
    recipient_phone: "01712345678",
    recipient_address: "House 10, Road 5, Dhanmondi, Dhaka",
    delivery_type: DeliveryType.NORMAL,
    item_type: ItemType.PARCEL,
    item_quantity: 1,
    item_weight: 0.5,
    amount_to_collect: 300,
  },
  {
    store_id: 12345,
    recipient_name: "Bob",
    recipient_phone: "01812345678",
    recipient_address: "House 3, Road 14, Gulshan, Dhaka",
    delivery_type: DeliveryType.NORMAL,
    item_type: ItemType.PARCEL,
    item_quantity: 2,
    item_weight: 1.0,
    amount_to_collect: 800,
  },
]);

// Bulk order creation is asynchronous — response is HTTP 202
console.log(result.code); // 202
console.log(result.data); // true
```

### Store Management

#### Create Store

```typescript
const store = await pathao.createStore({
  name: "My Dhaka Store", // Required — 3–50 characters
  contact_name: "Store Manager", // Required — 3–50 characters
  contact_number: "01712345678", // Required — 11 digits, starts with 01
  secondary_contact: "01812345678", // Optional
  otp_number: "01712345678", // Optional — OTP delivery number
  address: "House 10, Road 5, Dhanmondi, Dhaka", // Required — 15–120 chars
  city_id: 1, // Required
  zone_id: 1, // Required
  area_id: 37, // Required
});

// Store requires Pathao approval (~1 hour) before it can be used
console.log(store.data.store_name);
```

#### Get Stores

```typescript
const stores = await pathao.getStores(); // first page
const stores = await pathao.getStores(2); // specific page

// Paginated response
stores.data.data.forEach((s) => {
  console.log(s.store_id, s.store_name, s.is_active);
});

// Auto-fetch all pages
const allStores = await pathao.getStoresAll();
```

### Price Calculation

```typescript
const price = await pathao.calculatePrice({
  store_id: 12345,
  item_type: ItemType.PARCEL,
  delivery_type: DeliveryType.NORMAL,
  item_weight: 0.5,
  recipient_city: 1,
  recipient_zone: 1,
});

console.log(price.data.price); // base price
console.log(price.data.discount);
console.log(price.data.final_price); // price to display to customer
console.log(price.data.cod_enabled); // 0 | 1
console.log(price.data.cod_percentage); // e.g. 0.01
```

### Location Services

```typescript
// Cities
const cities = await pathao.getCities();
// [{ city_id: 1, city_name: "Dhaka" }, ...]

// Zones within a city
const zones = await pathao.getZones(1);
// [{ zone_id: 298, zone_name: "60 feet" }, ...]

// Areas within a zone
const areas = await pathao.getAreas(298);
// [{ area_id: 37, area_name: "Bonolota", home_delivery_available: true, pickup_available: true }, ...]
```

### Validation Helpers

All helpers are static and can be used before constructing the SDK:

```typescript
import { PathaoApiService } from "pathao-merchant-sdk";

PathaoApiService.validatePhoneNumber("01712345678"); // true  — 11 digits, starts with 01
PathaoApiService.validateContactNumber("01712345678"); // true  — same rules
PathaoApiService.validateAddress("House 10, Road 5, Dhanmondi, Dhaka"); // true — 10–220 chars
PathaoApiService.validateStoreAddress("House 10, Road 5, Dhanmondi"); // true — 15–120 chars
PathaoApiService.validateWeight(0.5); // true  — 0.5–10 kg
PathaoApiService.validateRecipientName("John Doe"); // true  — 3–100 chars
PathaoApiService.validateStoreName("My Store"); // true  — 3–50 chars
```

---

## Error Handling

All API errors are thrown as `PathaoApiError`:

```typescript
import { PathaoApiService, PathaoApiError } from "pathao-merchant-sdk";

try {
  const order = await pathao.createOrder(orderData);
} catch (err) {
  if (err instanceof PathaoApiError) {
    console.error("HTTP status:", err.status); // e.g. 422
    console.error("Pathao code:", err.code); // Pathao internal error code
    console.error("Type:", err.type); // e.g. "ValidationException"
    console.error("Message:", err.message);
    console.error("Field errors:", err.errors); // { field: "message" }
    console.error("Validation:", err.validation);
  }
}
```

### Common error scenarios

| Status | Cause                                                        |
| ------ | ------------------------------------------------------------ |
| 400    | Bad request / missing required fields                        |
| 401    | Invalid or expired credentials                               |
| 422    | Validation failure — check `err.errors` for field details    |
| 429    | Rate limited — SDK retries automatically after `Retry-After` |
| 503    | Circuit breaker open — too many consecutive failures         |

---

## Webhooks

The webhooks module is a **separate entry point** with zero runtime dependencies (Node.js built-ins only).

### How Pathao webhooks work

1. Pathao sends a POST request with a JSON payload to your URL.
2. The `X-PATHAO-Signature` header contains your configured webhook secret verbatim.
3. Your endpoint must respond within 10 seconds with an `X-Pathao-Merchant-Webhook-Integration-Secret` header whose value equals your webhook secret.
4. The HTTP status code should be 2xx.

### Setup requirements

- Your URL must be publicly reachable over HTTPS with a valid SSL certificate.
- Configure your webhook URL and note the secret from the [Pathao Merchant Dashboard](https://merchant.pathao.com/developer).
- Store the secret in an environment variable (e.g. `PATHAO_WEBHOOK_SECRET`).

### Import

```typescript
// ESM / TypeScript
import {
  PathaoWebhookHandler,
  PathaoWebhookEvent,
  constructEvent,
  PathaoWebhookError,
} from "pathao-merchant-sdk/webhooks";

// CommonJS
const { PathaoWebhookHandler } = require("pathao-merchant-sdk/webhooks");
```

### Express integration

```typescript
import express from "express";
import {
  PathaoWebhookHandler,
  PathaoWebhookEvent,
} from "pathao-merchant-sdk/webhooks";

const app = express();
const handler = new PathaoWebhookHandler(process.env.PATHAO_WEBHOOK_SECRET!);

handler.on(PathaoWebhookEvent.ORDER_DELIVERED, (payload) => {
  console.log(
    "Delivered:",
    payload.consignment_id,
    "Collected:",
    payload.collected_amount,
  );
});

handler.on(PathaoWebhookEvent.ORDER_PAID, (payload) => {
  console.log("Invoice:", payload.invoice_id);
});

handler.on("error", (err) => {
  console.error("Webhook error:", err.message);
});

app.post(
  "/webhooks/pathao",
  express.json(),
  handler.expressMiddleware(),
  (req, res) => {
    // expressMiddleware() sets the required secret header automatically.
    // It also handles the handshake event internally (returns 202).
    // For all other events the payload is on req.pathaoWebhook.
    res.sendStatus(200);
  },
);
```

### Framework-agnostic middleware

```typescript
const handler = new PathaoWebhookHandler(process.env.PATHAO_WEBHOOK_SECRET!);
const middleware = handler.middleware();

// In any async handler (Fastify, Hono, plain http, etc.)
const instructions = await middleware(rawBody);

for (const [key, value] of Object.entries(instructions.headers)) {
  reply.header(key, value); // always set — the secret header is required for every response
}

if (instructions.error) {
  return reply.status(400).send({ error: instructions.error.message });
}

if (instructions.payload?.event === "webhook_integration") {
  return reply.status(202).send();
}

// instructions.payload is typed as PathaoWebhookPayload
console.log(instructions.payload?.event);
return reply.status(200).send({ received: true });
```

### Parse and verify manually

```typescript
import {
  constructEvent,
  PathaoWebhookError,
} from "pathao-merchant-sdk/webhooks";

app.post("/webhooks/pathao", express.json(), (req, res) => {
  res.setHeader(
    "X-Pathao-Merchant-Webhook-Integration-Secret",
    process.env.PATHAO_WEBHOOK_SECRET!,
  );
  try {
    const payload = constructEvent(req.body);
    console.log("Event:", payload.event);
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof PathaoWebhookError) {
      res.status(400).send(err.message);
    } else {
      res.sendStatus(500);
    }
  }
});
```

### Supported event types

All 24 event types from the Pathao dashboard:

| Enum constant                     | Event string                      | Key payload fields                                                           |
| --------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| `ORDER_CREATED`                   | `order.created`                   | `consignment_id`, `store_id`, `delivery_fee`                                 |
| `ORDER_UPDATED`                   | `order.updated`                   | `consignment_id`, `store_id`, `delivery_fee`                                 |
| `ORDER_PICKUP_REQUESTED`          | `order.pickup-requested`          | `consignment_id`, `store_id`, `delivery_fee`                                 |
| `ORDER_ASSIGNED_FOR_PICKUP`       | `order.assigned-for-pickup`       | `consignment_id`, `store_id`                                                 |
| `ORDER_PICKED`                    | `order.picked`                    | `consignment_id`, `store_id`                                                 |
| `ORDER_PICKUP_FAILED`             | `order.pickup-failed`             | `consignment_id`, `store_id`                                                 |
| `ORDER_PICKUP_CANCELLED`          | `order.pickup-cancelled`          | `consignment_id`, `store_id`                                                 |
| `ORDER_AT_THE_SORTING_HUB`        | `order.at-the-sorting-hub`        | `consignment_id`, `store_id`                                                 |
| `ORDER_IN_TRANSIT`                | `order.in-transit`                | `consignment_id`, `store_id`                                                 |
| `ORDER_RECEIVED_AT_LAST_MILE_HUB` | `order.received-at-last-mile-hub` | `consignment_id`, `store_id`                                                 |
| `ORDER_ASSIGNED_FOR_DELIVERY`     | `order.assigned-for-delivery`     | `consignment_id`, `store_id`                                                 |
| `ORDER_DELIVERED`                 | `order.delivered`                 | `consignment_id`, `store_id`, `collected_amount`                             |
| `ORDER_PARTIAL_DELIVERY`          | `order.partial-delivery`          | `consignment_id`, `collected_amount`, `reason?`                              |
| `ORDER_RETURNED`                  | `order.returned`                  | `consignment_id`, `reason?`                                                  |
| `ORDER_DELIVERY_FAILED`           | `order.delivery-failed`           | `consignment_id`, `reason?`                                                  |
| `ORDER_ON_HOLD`                   | `order.on-hold`                   | `consignment_id`, `reason?`                                                  |
| `ORDER_PAID`                      | `order.paid`                      | `consignment_id`, `invoice_id`                                               |
| `ORDER_PAID_RETURN`               | `order.paid-return`               | `consignment_id`, `collected_amount`, `reason?`                              |
| `ORDER_EXCHANGED`                 | `order.exchanged`                 | `consignment_id`, `collected_amount`, `reason?`                              |
| `ORDER_RETURN_ID_CREATED`         | `order.return-id-created`         | `consignment_id`, `return_consignment_id`, `return_type`, `collected_amount` |
| `ORDER_RETURN_IN_TRANSIT`         | `order.return-in-transit`         | `consignment_id`, `return_consignment_id`, `return_type`, `collected_amount` |
| `ORDER_RETURNED_TO_MERCHANT`      | `order.returned-to-merchant`      | `consignment_id`, `return_consignment_id`, `return_type`, `collected_amount` |
| `STORE_CREATED`                   | `store.created`                   | `store_id`, `store_name`, `store_address`, `is_active`                       |
| `STORE_UPDATED`                   | `store.updated`                   | `store_id`, `store_name`, `store_address`, `is_active`                       |

All payloads also include `updated_at` (MySQL datetime) and `timestamp` (ISO 8601).

---

## TypeScript Types

```typescript
import type {
  PathaoConfig,
  PathaoOrderRequest,
  PathaoOrderResponse,
  PathaoStoreRequest,
  PathaoStore,
  PathaoPriceRequest,
  PathaoPriceResponse,
  PathaoOrderStatusResponse,
  DeliveryType,
  ItemType,
} from "pathao-merchant-sdk";

import type {
  PathaoWebhookPayload,
  WebhookEventPayloadMap,
  OrderDeliveredPayload,
  OrderReturnIdCreatedPayload,
  PathaoWebhookEvent,
} from "pathao-merchant-sdk/webhooks";

// Access a specific payload type via the map
type PaidPayload = WebhookEventPayloadMap[PathaoWebhookEvent.ORDER_PAID];
```

---

## Contributing

Contributions are welcome. Please open an issue first for significant changes.

1. Fork the repo
2. Create a feature branch
3. Run `pnpm test` and `pnpm run type-check` before submitting

## Development

```bash
pnpm install
pnpm run build      # compile CJS + ESM + .d.ts
pnpm test           # run Jest test suite
pnpm run type-check # tsc --noEmit
pnpm run lint       # ESLint
```

## License

MIT — see [LICENSE](LICENSE).

## Support

Open an issue on [GitHub](https://github.com/sifat07/pathao-merchant-sdk/issues).

---

## Changelog

### 2.2.0 — 2026-04-15

- Added 3 missing webhook event types from official dashboard docs: `order.return-id-created`, `order.return-in-transit`, `order.returned-to-merchant` with full `ReturnOrderWebhookPayload` type
- Fixed tsconfig: added `node` and `jest` to `types` so `Buffer`/`EventEmitter` resolve correctly
- Fixed webhook header handling and improved event processing robustness

### 2.1.0

- Added `pathao-merchant-sdk/webhooks` sub-path entry point
- `PathaoWebhookHandler` — EventEmitter with typed `on()` overloads for all event types
- `constructEvent()` standalone helper
- Express middleware and generic async middleware

### 2.0.x

- Factory methods: `fromEnv()`, `fromConfig()`, `sandbox()`, `production()`
- Debug logging (`debug` option) — `Authorization` header redacted
- Configurable circuit breaker (throws `PathaoApiError` code 503 when open)
- Retry logic: 429 reads `Retry-After`, 5xx exponential backoff (max 2 retries)
- Deferred config validation — constructor never throws
- HTTPS enforcement in `validateConfiguration()`
- `User-Agent: pathao-merchant-sdk node/<version>` header
- `getStores(page?)` pagination parameter
- `is_active` and `cod_enabled` typed as `0 | 1`
- Fixed shell injection in `scripts/release.js`

### 1.0.0

- Initial release — order management, store management, price calculation, location services, automatic OAuth2
