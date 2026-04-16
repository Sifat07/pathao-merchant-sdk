# Pathao Webhook Documentation

> Source: Pathao Merchant Dashboard → [courier/developer-api](https://merchant.pathao.com/courier/developer-api) → Webhook tab

## Overview

Pathao sends webhook events as HTTP POST requests to your configured URL whenever an order or store status changes.

### Requirements for your endpoint

- Must be publicly reachable over HTTPS with a valid SSL certificate
- Must resolve within 3 redirections
- Must respond within **10 seconds**
- Must return the `X-Pathao-Merchant-Webhook-Integration-Secret` response header on **every** response, with your webhook secret as the value

### Verification mechanism

Pathao does **not** sign inbound requests with HMAC. Instead, it sends your configured webhook secret in the `X-PATHAO-Signature` request header, and verifies your endpoint by checking that your response includes the same secret in `X-Pathao-Merchant-Webhook-Integration-Secret`.

### Inbound request headers

| Header | Value |
|--------|-------|
| `X-PATHAO-Signature` | Your configured webhook secret |
| `Content-Type` | `application/json` |

### Required response header

| Header | Value |
|--------|-------|
| `X-Pathao-Merchant-Webhook-Integration-Secret` | Your configured webhook secret |

---

## Payload structure

All payloads share these common fields:

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Event type (see tables below) |
| `updated_at` | string | Timestamp in MySQL format (`YYYY-MM-DD HH:MM:SS`, no timezone) |
| `timestamp` | string | Timestamp in ISO 8601 format |

---

## Order Events

### order.created

```json
{
  "event": "order.created",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "delivery_fee": 83.46,
  "updated_at": "2024-12-27 23:49:43",
  "timestamp": "2024-12-27T17:49:43+00:00"
}
```

### order.updated

```json
{
  "event": "order.updated",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "delivery_fee": 83.46,
  "updated_at": "2024-12-27 23:50:16",
  "timestamp": "2024-12-27T17:50:16+00:00"
}
```

### order.pickup-requested

```json
{
  "event": "order.pickup-requested",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "delivery_fee": 83.46,
  "updated_at": "2024-12-27 23:50:32",
  "timestamp": "2024-12-27T17:50:32+00:00"
}
```

### order.assigned-for-pickup

```json
{
  "event": "order.assigned-for-pickup",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "updated_at": "2024-12-27 23:51:01",
  "timestamp": "2024-12-27T17:51:01+00:00"
}
```

### order.picked

```json
{
  "event": "order.picked",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "updated_at": "2024-12-27 23:51:17",
  "timestamp": "2024-12-27T17:51:17+00:00"
}
```

### order.pickup-failed

```json
{
  "event": "order.pickup-failed",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "updated_at": "2024-12-27 23:51:33",
  "timestamp": "2024-12-27T17:51:33+00:00"
}
```

### order.pickup-cancelled

```json
{
  "event": "order.pickup-cancelled",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "updated_at": "2024-12-27 23:51:49",
  "timestamp": "2024-12-27T17:51:49+00:00"
}
```

### order.at-the-sorting-hub

```json
{
  "event": "order.at-the-sorting-hub",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "updated_at": "2024-12-27 23:52:15",
  "timestamp": "2024-12-27T17:52:15+00:00"
}
```

### order.in-transit

```json
{
  "event": "order.in-transit",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "updated_at": "2024-12-27 23:52:32",
  "timestamp": "2024-12-27T17:52:32+00:00"
}
```

### order.received-at-last-mile-hub

```json
{
  "event": "order.received-at-last-mile-hub",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "updated_at": "2024-12-27 23:52:48",
  "timestamp": "2024-12-27T17:52:48+00:00"
}
```

### order.assigned-for-delivery

```json
{
  "event": "order.assigned-for-delivery",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "updated_at": "2024-12-27 23:53:05",
  "timestamp": "2024-12-27T17:53:05+00:00"
}
```

### order.delivered

```json
{
  "event": "order.delivered",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "collected_amount": 60,
  "updated_at": "2024-12-27 23:53:23",
  "timestamp": "2024-12-27T17:53:23+00:00"
}
```

### order.partial-delivery

```json
{
  "event": "order.partial-delivery",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "collected_amount": 60,
  "reason": "This field might not be present in some cases.",
  "updated_at": "2024-12-27 23:53:45",
  "timestamp": "2024-12-27T17:53:45+00:00"
}
```

### order.returned

```json
{
  "event": "order.returned",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "reason": "This field might not be present in some cases.",
  "updated_at": "2024-12-27 23:54:02",
  "timestamp": "2024-12-27T17:54:02+00:00"
}
```

### order.delivery-failed

```json
{
  "event": "order.delivery-failed",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "reason": "This field might not be present in some cases.",
  "updated_at": "2024-12-27 23:54:21",
  "timestamp": "2024-12-27T17:54:21+00:00"
}
```

### order.on-hold

```json
{
  "event": "order.on-hold",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "reason": "This field might not be present in some cases.",
  "updated_at": "2024-12-27 23:54:46",
  "timestamp": "2024-12-27T17:54:46+00:00"
}
```

### order.paid

```json
{
  "event": "order.paid",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "invoice_id": "121224IBW19790",
  "updated_at": "2024-12-27 23:55:01",
  "timestamp": "2024-12-27T17:55:01+00:00"
}
```

### order.paid-return

```json
{
  "event": "order.paid-return",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "collected_amount": 60,
  "reason": "This field might not be present in some cases.",
  "updated_at": "2024-12-27 23:55:17",
  "timestamp": "2024-12-27T17:55:17+00:00"
}
```

### order.exchanged

```json
{
  "event": "order.exchanged",
  "consignment_id": "DL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "collected_amount": 60,
  "reason": "This field might not be present in some cases.",
  "updated_at": "2024-12-27 23:55:34",
  "timestamp": "2024-12-27T17:55:34+00:00"
}
```

---

## Return Journey Events

These three events track the physical return of a parcel to the merchant. They share additional fields: `return_consignment_id` and `return_type`.

### order.return-id-created

Fired when a return consignment ID is generated.

```json
{
  "event": "order.return-id-created",
  "consignment_id": "DL121224VS8TTJ",
  "return_consignment_id": "RL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "collected_amount": 60,
  "return_type": "return|paid-return|exchange|partial-delivery",
  "reason": "This field might not be present in some cases.",
  "updated_at": "2024-12-27 23:55:34",
  "timestamp": "2024-12-27T17:55:34+00:00"
}
```

### order.return-in-transit

Fired when the return parcel is in transit back to the merchant.

```json
{
  "event": "order.return-in-transit",
  "consignment_id": "DL121224VS8TTJ",
  "return_consignment_id": "RL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "collected_amount": 60,
  "return_type": "return|paid-return|exchange|partial-delivery",
  "reason": "This field might not be present in some cases.",
  "updated_at": "2024-12-27 23:55:34",
  "timestamp": "2024-12-27T17:55:34+00:00"
}
```

### order.returned-to-merchant

Fired when the parcel has been physically returned to the merchant.

```json
{
  "event": "order.returned-to-merchant",
  "consignment_id": "DL121224VS8TTJ",
  "return_consignment_id": "RL121224VS8TTJ",
  "merchant_order_id": "TS-123",
  "store_id": 130820,
  "collected_amount": 60,
  "return_type": "return|paid-return|exchange|partial-delivery",
  "reason": "This field might not be present in some cases.",
  "updated_at": "2024-12-27 23:55:34",
  "timestamp": "2024-12-27T17:55:34+00:00"
}
```

**`return_type` values**

| Value | Description |
|-------|-------------|
| `return` | Standard return |
| `paid-return` | Return after payment was collected |
| `exchange` | Exchange order |
| `partial-delivery` | Partially delivered order |

---

## Store Events

### store.created

```json
{
  "event": "store.created",
  "store_id": 1,
  "store_name": "Test Store",
  "store_address": "Test store address",
  "is_active": 1,
  "updated_at": "2024-12-27 23:55:34",
  "timestamp": "2024-12-27T17:55:34+00:00"
}
```

### store.updated

```json
{
  "event": "store.updated",
  "store_id": 1,
  "store_name": "Test Store",
  "store_address": "Test store address",
  "is_active": 1,
  "updated_at": "2024-12-27 23:55:34",
  "timestamp": "2024-12-27T17:55:34+00:00"
}
```

---

## Event Reference

| Event | SDK Constant | Key extra fields |
|-------|-------------|-----------------|
| `order.created` | `ORDER_CREATED` | `delivery_fee` |
| `order.updated` | `ORDER_UPDATED` | `delivery_fee` |
| `order.pickup-requested` | `ORDER_PICKUP_REQUESTED` | `delivery_fee` |
| `order.assigned-for-pickup` | `ORDER_ASSIGNED_FOR_PICKUP` | — |
| `order.picked` | `ORDER_PICKED` | — |
| `order.pickup-failed` | `ORDER_PICKUP_FAILED` | — |
| `order.pickup-cancelled` | `ORDER_PICKUP_CANCELLED` | — |
| `order.at-the-sorting-hub` | `ORDER_AT_THE_SORTING_HUB` | — |
| `order.in-transit` | `ORDER_IN_TRANSIT` | — |
| `order.received-at-last-mile-hub` | `ORDER_RECEIVED_AT_LAST_MILE_HUB` | — |
| `order.assigned-for-delivery` | `ORDER_ASSIGNED_FOR_DELIVERY` | — |
| `order.delivered` | `ORDER_DELIVERED` | `collected_amount` |
| `order.partial-delivery` | `ORDER_PARTIAL_DELIVERY` | `collected_amount`, `reason?` |
| `order.returned` | `ORDER_RETURNED` | `reason?` |
| `order.delivery-failed` | `ORDER_DELIVERY_FAILED` | `reason?` |
| `order.on-hold` | `ORDER_ON_HOLD` | `reason?` |
| `order.paid` | `ORDER_PAID` | `invoice_id` |
| `order.paid-return` | `ORDER_PAID_RETURN` | `collected_amount`, `reason?` |
| `order.exchanged` | `ORDER_EXCHANGED` | `collected_amount`, `reason?` |
| `order.return-id-created` | `ORDER_RETURN_ID_CREATED` | `return_consignment_id`, `return_type`, `collected_amount`, `reason?` |
| `order.return-in-transit` | `ORDER_RETURN_IN_TRANSIT` | `return_consignment_id`, `return_type`, `collected_amount`, `reason?` |
| `order.returned-to-merchant` | `ORDER_RETURNED_TO_MERCHANT` | `return_consignment_id`, `return_type`, `collected_amount`, `reason?` |
| `store.created` | `STORE_CREATED` | `store_name`, `store_address`, `is_active` |
| `store.updated` | `STORE_UPDATED` | `store_name`, `store_address`, `is_active` |
