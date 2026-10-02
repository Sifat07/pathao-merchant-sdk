# Pathao Merchant SDK

[![npm version](https://img.shields.io/npm/v/pathao-merchant-sdk.svg)](https://www.npmjs.com/package/pathao-merchant-sdk)
[![npm downloads](https://img.shields.io/npm/dm/pathao-merchant-sdk.svg)](https://www.npmjs.com/package/pathao-merchant-sdk)
[![bundle size](https://img.shields.io/bundlephobia/minzip/pathao-merchant-sdk.svg)](https://bundlephobia.com/package/pathao-merchant-sdk)
[![GitHub stars](https://img.shields.io/github/stars/sifat07/pathao-merchant-sdk.svg)](https://github.com/sifat07/pathao-merchant-sdk/stargazers)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/sifat07/pathao-merchant-sdk/ci-cd.yml?branch=main)](https://github.com/sifat07/pathao-merchant-sdk/actions)

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
- [Upgrading to 3.0.0](#upgrading-to-300)
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

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
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

Only `PathaoApiService.fromEnv()` reads these variables. `new PathaoApiService(config)`, `fromConfig()`, `sandbox()` and `production()` use exactly the config you pass, so a blank field fails validation instead of silently picking up another account's credentials from the environment (important when each tenant brings their own Pathao account).

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
  minRequestIntervalMs: 0, // Min gap between requests, queued (default: 0, off)
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
  recipient_phone: "01712345678", // Required — BD mobile; +880… / dashes are normalised before sending
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

PathaoApiService.validatePhoneNumber("+8801712345678"); // true  — BD mobile, 013–019
PathaoApiService.normalizePhoneNumber("+880 1712-345678"); // "01712345678" (null if invalid)
PathaoApiService.validateContactNumber("01712345678"); // true  — same rules
PathaoApiService.validateAddress("House 10, Road 5, Dhanmondi, Dhaka"); // true — 10–220 chars
PathaoApiService.validateStoreAddress("House 10, Road 5, Dhanmondi"); // true — 15–120 chars
PathaoApiService.validateWeight(0.5); // true  — 0.5–10 kg
PathaoApiService.validateRecipientName("John Doe"); // true  — 3–100 chars
PathaoApiService.validateStoreName("My Store"); // true  — 3–50 chars
```

`createOrder` and `createBulkOrder` run the phone, name, address and weight checks before sending (a bulk failure names the index, e.g. `orders[3]: …`), and send the normalised phone numbers.

---

## Error Handling

All API errors are thrown as `PathaoApiError`:

```typescript
import { PathaoApiService, PathaoApiError } from "pathao-merchant-sdk";

try {
  const order = await pathao.createOrder(orderData);
} catch (err) {
  if (err instanceof PathaoApiError) {
    console.error("Kind:", err.kind, "retryable:", err.retryable); // e.g. "validation", false
    console.error("HTTP status:", err.status); // e.g. 422
    console.error("Pathao code:", err.code); // Pathao internal error code
    console.error("Type:", err.type); // e.g. "ValidationException"
    console.error("Message:", err.message);
    console.error("Field errors:", err.errors); // { field: "message" }
    console.error("Validation:", err.validation);
  }
}
```

### Error kinds

Branch on `err.kind` instead of matching message text. `err.retryable` is `true` for `unavailable` and `rate_limited`.

| `kind`         | When                                                        |
| -------------- | ----------------------------------------------------------- |
| `validation`   | Rejected by the SDK before sending, or HTTP 400/422         |
| `config`       | Missing/invalid `baseURL` or credentials                    |
| `auth`         | HTTP 401                                                    |
| `forbidden`    | HTTP 403, or 402 (unpaid dues block new orders)             |
| `not_found`    | HTTP 404                                                    |
| `rate_limited` | HTTP 429                                                    |
| `unavailable`  | 5xx, timeout, network failure, circuit breaker open         |
| `unexpected`   | Anything else; inspect `err.responseData`                   |

A retryable error on `createOrder` / `createBulkOrder` may still have booked the parcel. Look the order up before retrying a create.

### Common error scenarios

| Status | Cause                                                        |
| ------ | ------------------------------------------------------------ |
| 400    | Bad request / missing required fields                        |
| 401    | Invalid or expired credentials                               |
| 422    | Validation failure — check `err.errors` for field details    |
| 429    | Rate limited — see below                                     |
| 503    | Circuit breaker open — repeated network, 5xx or 401 failures |

### Rate limits

Pathao doesn't document its limits. Measured against its gateway (Sep 2026): **60 requests per rolling 60 seconds**, and the `429` carries **no `Retry-After` header**. The SDK therefore does not retry a `429` unless the server sends `Retry-After`; it throws `PathaoApiError` with `status: 429` so you can back off. 429s never open the circuit breaker.

For bulk work (e.g. polling `getOrderStatus` for many orders) pass `minRequestIntervalMs: 1500`. The client then queues its requests (token grants and retries included) one every 1.5 s, about 40/min, leaving headroom for webhooks and other callers sharing the same credentials. Spacing is per instance: share one instance across the process.

Both numbers are exported: `PATHAO_RATE_LIMIT_PER_MINUTE` (60) and `PATHAO_STATUS_RETENTION_DAYS` (90, roughly how long `getOrderStatus` finds an order).

### Retries

The SDK retries a `5xx` up to twice, but only for requests that are safe to repeat: GETs, token grants and `calculatePrice`. `createOrder`, `createBulkOrder` and `createStore` are **never** retried, because a `5xx` (e.g. a gateway `504` in front of a slow success) doesn't mean the order wasn't booked. If you retry a create yourself, look the order up first, or you may book the parcel twice.

### Order lifecycle

Webhook events and `order_status_slug` describe the same journey. Despite its name, `order_status_slug` is a display label (`"Pending"`, `"In Transit"`, `"Return"`), and Pathao's own plugin spells the same states differently (`Pickup_Requested`, `At_the_Sorting_HUB`), so the SDK doesn't type it. `toLifecycleStatus` maps any of these spellings, or a webhook event (`order.pickup-requested`), to one of `created`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `partial`, `on_hold`, `returning`, `returned`, `cancelled`, or `unknown`.

```typescript
import { toLifecycleStatus, isFinalLifecycleStatus } from "pathao-merchant-sdk"; // also exported from /webhooks

toLifecycleStatus("order.return-id-created"); // "returning" — not back yet, don't restock
toLifecycleStatus(info.data.order_status_slug);
isFinalLifecycleStatus("delivered"); // true
```

---

## Webhooks

The webhooks module is a **separate entry point** with zero runtime dependencies (Node.js built-ins only).

### How Pathao webhooks work

1. Pathao sends a POST request with a JSON payload to your URL.
2. The `X-PATHAO-Signature` header contains the webhook secret verbatim.
3. Your endpoint must respond within 10 seconds with an `X-Pathao-Merchant-Webhook-Integration-Secret` header whose value equals the webhook secret.
4. The HTTP status code should be 2xx.

> [!WARNING]
> **Webhooks are not authenticated.** The webhook secret is one fixed value shared by every merchant (it is hardcoded in Pathao's own open-source WooCommerce plugin), so anyone can send a request that looks like it came from Pathao. Never apply status, fee or COD amounts straight from a payload. Use the webhook only as a signal: look up your own order by `consignment_id`, then fetch the real state with `getOrderStatus()` and act on that. An unguessable callback URL (e.g. `/webhooks/pathao/<random-token>`) cuts down junk traffic, since the URL is the one thing only you and Pathao know.

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

// Payloads whose `event` isn't a known PathaoWebhookEvent arrive here, never
// under their own name (so a forged {"event":"error"} can't fire "error").
handler.on("unknown", (payload) => {
  console.warn("Unrecognised Pathao event:", payload.event);
});

app.post(
  "/webhooks/pathao",
  express.raw({ type: "application/json" }),
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

app.post("/webhooks/pathao", express.raw({ type: "application/json" }), (req, res) => {
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
  PathaoClientOptions,
  PathaoErrorKind,
  PathaoLifecycleStatus,
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
  UnknownWebhookPayload,
  PathaoWebhookEvent,
} from "pathao-merchant-sdk/webhooks";

// Access a specific payload type via the map
type PaidPayload = WebhookEventPayloadMap[PathaoWebhookEvent.ORDER_PAID];
```

---

## Upgrading to 3.0.0

3.0.0 has **one breaking change**. Most apps need no code changes; check the table below if you catch specific errors or listen for unusual webhook events.

### Required: explicit config no longer reads environment variables

In 2.x, `new PathaoApiService(config)` (and `fromConfig()`, `sandbox()`, `production()`) filled any blank field from `PATHAO_*` environment variables and read `PATHAO_TIMEOUT`. In a multi-tenant app, a tenant with a blank field silently used the platform's own Pathao account. In 3.0.0 those constructors use **exactly** the config you pass. Only `fromEnv()` reads the environment.

**You are affected if** you leave config fields blank or omit them and rely on the environment to fill them in, or set `PATHAO_TIMEOUT` without using `fromEnv()`.

```typescript
// 2.x — blank fields came from PATHAO_* env vars
const pathao = new PathaoApiService({ baseURL: "https://api-hermes.pathao.com" } as PathaoConfig);
const sandbox = PathaoApiService.sandbox({ clientId: "", clientSecret: "", username: "", password: "" });

// 3.0.0 — either read everything from the environment...
const pathao = PathaoApiService.fromEnv(); // PATHAO_BASE_URL, _CLIENT_ID, _CLIENT_SECRET, _USERNAME, _PASSWORD, _TIMEOUT

// ...or pass every field yourself
const pathao = new PathaoApiService({
  baseURL: process.env.PATHAO_BASE_URL!,
  clientId: process.env.PATHAO_CLIENT_ID!,
  clientSecret: process.env.PATHAO_CLIENT_SECRET!,
  username: process.env.PATHAO_USERNAME!,
  password: process.env.PATHAO_PASSWORD!,
  timeout: 30_000,
});
```

If you already pass every field explicitly, nothing changes. A missing field now fails on the first API call with `PathaoApiError` (`kind: "config"`) instead of quietly using another account.

### Behaviour changes to check

| Change | Affects you if… | What to do |
| --- | --- | --- |
| `createOrder`, `createBulkOrder` and `createStore` are no longer auto-retried on `5xx` | You relied on the SDK to retry failed creates | Retry yourself, but look the order up first: a `5xx` may hide a booking that went through. See [Retries](#retries). |
| `createOrder` / `createBulkOrder` validate the secondary phone, recipient name (3–100) and address (10–220) before sending | You send data Pathao would have rejected with a `422` | Fix the data. The error is `PathaoApiError` with `kind: "validation"`; bulk errors name the order (`orders[2]: …`). |
| Phone numbers are normalised before sending, and only operator prefixes `013`–`019` are valid | You send `+880…` / `017-…` (now accepted), or `011…` / `012…` (now rejected; BTRC lists these as unused) | Nothing for real customers' numbers |
| Webhook events not in `PathaoWebhookEvent` are emitted as `'unknown'` | You call `handler.on("some.event")` for a name the SDK doesn't list | Listen on `'unknown'` and check `payload.event`. The `'webhook'` catch-all still fires for every event. |
| A webhook `event` must be a string | You process malformed payloads | Nothing; they now throw `PathaoWebhookError` |
| Any `3xx` response is an error (redirects are never followed) | Your `baseURL` points at something that redirects | Use the final URL |
| Some error messages were reworded (config errors, `formatPhoneNumber`) | You match on `err.message` | Switch to `err.kind` |
| ESM projects (`moduleResolution: node16`/`nodenext`) get the ESM type declarations | You worked around the old CJS-typed imports | Remove the workaround |

### New in 3.0.0 (optional)

- `err.kind` and `err.retryable` on `PathaoApiError` — see [Error kinds](#error-kinds)
- `toLifecycleStatus()` / `isFinalLifecycleStatus()` — see [Order lifecycle](#order-lifecycle)
- `minRequestIntervalMs` option — see [Rate limits](#rate-limits)
- `PathaoApiService.normalizePhoneNumber()`, `PATHAO_RATE_LIMIT_PER_MINUTE`, `PATHAO_STATUS_RETENTION_DAYS`
- `order_status` (optional) on order webhook payload types
- Debug logs no longer include token responses

---

## Contributing

Contributions are welcome. Please open an issue first for significant changes.

1. Fork the repo
2. Create a feature branch
3. Run `pnpm test` and `pnpm run type-check` before submitting

## Development

The repo pins pnpm 10 via `packageManager`. Run `corepack enable` once so `pnpm` uses it; pnpm 11+ ignores the `pnpm` settings in `package.json` and `pnpm install --frozen-lockfile` fails.

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

Full history: [CHANGELOG.md](CHANGELOG.md).

### 3.0.0

- **Breaking:** explicit config no longer falls back to `PATHAO_*` env vars; use `fromEnv()` — see [Upgrading to 3.0.0](#upgrading-to-300)
- Order and store creation are never auto-retried on `5xx` (prevents duplicate consignments)
- Debug logs redact token responses; redirects are never followed
- Webhooks: unknown event names go to `'unknown'`, never to reserved EventEmitter events
- Phones normalised (`+880…` accepted); orders fully validated before sending
- `PathaoApiError.kind` / `.retryable`, `toLifecycleStatus()`, `minRequestIntervalMs`, rate/retention constants
- Correct ESM types; `/webhooks` resolves under `node10`; CI on pnpm 10 and Node 18–24

### 2.3.0 — 2026-04-16

- Replaced broken `pnpm audit` with OSV Scanner (scoped to production dependencies)
- Fixed release-please to read from manifest — prevents wrong version PRs
- Fixed CI/CD: pinned pnpm to v9, added `permissions` blocks, fixed `manual-release.yml` broken scripts and step ordering

### 2.2.0 — 2026-04-16

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
- Retry logic: 429 retried only when the server sends `Retry-After`; 5xx exponential backoff (max 2 retries)
- Deferred config validation — constructor never throws
- HTTPS enforcement in `validateConfiguration()`
- `User-Agent: pathao-merchant-sdk node/<version>` header
- `getStores(page?)` pagination parameter
- `is_active` and `cod_enabled` typed as `0 | 1`
- Fixed shell injection in `scripts/release.js`

### 1.0.0

- Initial release — order management, store management, price calculation, location services, automatic OAuth2
