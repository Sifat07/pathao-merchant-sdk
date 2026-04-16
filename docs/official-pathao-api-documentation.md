# Pathao Courier Merchant API — Official Documentation

> Source: Pathao Merchant Dashboard → [courier/developer-api](https://merchant.pathao.com/courier/developer-api)

## Overview

Pathao uses OAuth 2.0 for authentication. The typical flow is:

1. Issue an access token using your credentials
2. Use the access token in the `Authorization` header for all subsequent requests
3. Refresh the access token using the refresh token when it expires

---

## Credentials

### Your API Credentials

Obtain your production `client_id` and `client_secret` from the **API Credentials** section of the [Pathao Merchant Dashboard](https://merchant.pathao.com/courier/developer-api).

### Sandbox / Test Environment

Use these publicly provided credentials to test against the sandbox:

| Field | Value |
|-------|-------|
| `base_url` | `https://courier-api-sandbox.pathao.com` |
| `client_id` | `7N1aMJQbWm` |
| `client_secret` | `wRcaibZkUdSNz2EI9ZyuXLlNrnAv0TdPUPXMnD39` |
| `username` | `test@pathao.com` |
| `password` | `lovePathao` |
| `grant_type` | `password` |

### Production / Live Environment

| Field | Value |
|-------|-------|
| `base_url` | `https://api-hermes.pathao.com` |
| `client_id` | From merchant dashboard |
| `client_secret` | From merchant dashboard |

---

## Authentication

### Issue an Access Token

**`POST /aladdin/api/v1/issue-token`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/issue-token' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "client_id": "{{client_id}}",
    "client_secret": "{{client_secret}}",
    "grant_type": "password",
    "username": "{{your_email}}",
    "password": "{{your_password}}"
  }'
```

**Request parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | string | Yes | Your client ID |
| `client_secret` | string | Yes | Your client secret |
| `grant_type` | string | Yes | Must be `password` |
| `username` | string | Yes | Your login email |
| `password` | string | Yes | Your login password |

**Response (200)**

```json
{
  "token_type": "Bearer",
  "expires_in": 432000,
  "access_token": "ISSUED_ACCESS_TOKEN",
  "refresh_token": "ISSUED_REFRESH_TOKEN"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `token_type` | string | Always `Bearer` |
| `expires_in` | integer | Token expiry in seconds (432000 = 5 days) |
| `access_token` | string | Use in `Authorization: Bearer <token>` header |
| `refresh_token` | string | Use to obtain a new access token |

---

### Refresh an Access Token

**`POST /aladdin/api/v1/issue-token`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/issue-token' \
  --header 'Content-Type: application/json' \
  --data '{
    "client_id": "{{client_id}}",
    "client_secret": "{{client_secret}}",
    "grant_type": "refresh_token",
    "refresh_token": "ISSUED_REFRESH_TOKEN"
  }'
```

**Request parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | string | Yes | Your client ID |
| `client_secret` | string | Yes | Your client secret |
| `grant_type` | string | Yes | Must be `refresh_token` |
| `refresh_token` | string | Yes | Your current refresh token |

**Response (200)** — same structure as issue token above.

---

## Stores

### Create a Store

**`POST /aladdin/api/v1/stores`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/stores' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer {{access_token}}' \
  --data '{
    "name": "Demo Store",
    "contact_name": "Test Merchant",
    "contact_number": "017XXXXXXXX",
    "secondary_contact": "015XXXXXXXX",
    "otp_number": "017XXXXXXXX",
    "address": "House 123, Road 4, Sector 10, Uttara, Dhaka-1230, Bangladesh",
    "city_id": 1,
    "zone_id": 1,
    "area_id": 37
  }'
```

**Request parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Store name, 3–50 characters |
| `contact_name` | string | Yes | Contact person name, 3–50 characters |
| `contact_number` | string | Yes | 11 digits, starts with `01` |
| `secondary_contact` | string | No | Secondary phone, 11 digits |
| `otp_number` | string | No | Number to receive OTP for orders |
| `address` | string | Yes | Store address, 15–120 characters |
| `city_id` | integer | Yes | City ID (from city list) |
| `zone_id` | integer | Yes | Zone ID (from zone list) |
| `area_id` | integer | Yes | Area ID (from area list) |

**Response (200)**

```json
{
  "message": "Store created successfully, Please wait one hour for approval.",
  "type": "success",
  "code": 200,
  "data": {
    "store_name": "Demo Store"
  }
}
```

> New stores require approximately 1 hour for Pathao approval before they can be used for orders.

---

### Get Stores

**`GET /aladdin/api/v1/stores`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/stores' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer {{access_token}}'
```

**Response (200)**

```json
{
  "message": "Store list fetched.",
  "type": "success",
  "code": 200,
  "data": {
    "data": [
      {
        "store_id": 12345,
        "store_name": "Demo Store",
        "store_address": "House 123, Road 4, Sector 10, Uttara, Dhaka-1230, Bangladesh",
        "is_active": 1,
        "city_id": 1,
        "zone_id": 1,
        "hub_id": 10,
        "is_default_store": false,
        "is_default_return_store": false
      }
    ],
    "total": 1,
    "current_page": 1,
    "per_page": 1000,
    "last_page": 1,
    "first_page_url": "{{base_url}}/aladdin/api/v1/stores?page=1",
    "last_page_url": "{{base_url}}/aladdin/api/v1/stores?page=1"
  }
}
```

**Store object fields**

| Field | Type | Description |
|-------|------|-------------|
| `store_id` | integer | Unique store identifier |
| `store_name` | string | Store name |
| `store_address` | string | Store address |
| `is_active` | integer | `1` = active, `0` = deactivated |
| `city_id` | integer | City ID of the store |
| `zone_id` | integer | Zone ID of the store |
| `hub_id` | integer | Hub ID the store belongs to |
| `is_default_store` | boolean | Whether this is the default pickup store |
| `is_default_return_store` | boolean | Whether this is the default return store |

---

## Orders

### Create an Order

**`POST /aladdin/api/v1/orders`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/orders' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer {{access_token}}' \
  --data '{
    "store_id": 12345,
    "merchant_order_id": "YOUR-ORDER-ID",
    "recipient_name": "Demo Recipient",
    "recipient_phone": "017XXXXXXXX",
    "recipient_address": "House 123, Road 4, Sector 10, Uttara, Dhaka-1230, Bangladesh",
    "delivery_type": 48,
    "item_type": 2,
    "special_instruction": "Deliver before 5 PM",
    "item_quantity": 1,
    "item_weight": 0.5,
    "item_description": "Cotton shirt, price 3000",
    "amount_to_collect": 900
  }'
```

**Request parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `store_id` | integer | Yes | Your store ID (sets pickup location) |
| `merchant_order_id` | string | No | Your internal order tracking ID |
| `recipient_name` | string | Yes | 3–100 characters |
| `recipient_phone` | string | Yes | 11 digits, starts with `01` |
| `recipient_secondary_phone` | string | No | 11 digits |
| `recipient_address` | string | Yes | 10–220 characters |
| `recipient_city` | integer | No | City ID — auto-detected from address if omitted (do not send `null`) |
| `recipient_zone` | integer | No | Zone ID — auto-detected from address if omitted (do not send `null`) |
| `recipient_area` | integer | No | Area ID — auto-detected from address if omitted |
| `delivery_type` | integer | Yes | `48` = Normal, `12` = On Demand |
| `item_type` | integer | Yes | `1` = Document, `2` = Parcel |
| `item_quantity` | integer | Yes | Number of parcels |
| `item_weight` | float | Yes | Weight in kg, 0.5–10 |
| `item_description` | string | No | Parcel description |
| `special_instruction` | string | No | Delivery instructions |
| `amount_to_collect` | integer | Yes | COD amount (BDT); use `0` for prepaid orders |

**Response (200)**

```json
{
  "message": "Order Created Successfully",
  "type": "success",
  "code": 200,
  "data": {
    "consignment_id": "DL121224VS8TTJ",
    "merchant_order_id": "YOUR-ORDER-ID",
    "order_status": "Pending",
    "delivery_fee": 80
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `consignment_id` | string | Pathao tracking ID — use this for status lookups |
| `merchant_order_id` | string | Your provided order ID |
| `order_status` | string | Initial status (`Pending`) |
| `delivery_fee` | number | Delivery charge in BDT |

---

### Create Bulk Orders

**`POST /aladdin/api/v1/orders/bulk`**

Bulk order creation is **asynchronous** — the API accepts the request immediately and processes orders in the background.

```bash
curl --location '{{base_url}}/aladdin/api/v1/orders/bulk' \
  --header 'Content-Type: application/json; charset=UTF-8' \
  --header 'Authorization: Bearer {{access_token}}' \
  --data '{
    "orders": [
      {
        "store_id": 12345,
        "recipient_name": "Demo Recipient One",
        "recipient_phone": "017XXXXXXXX",
        "recipient_address": "House 123, Road 4, Sector 10, Uttara, Dhaka-1230, Bangladesh",
        "delivery_type": 48,
        "item_type": 2,
        "item_quantity": 2,
        "item_weight": 0.5,
        "amount_to_collect": 100
      },
      {
        "store_id": 12345,
        "recipient_name": "Demo Recipient Two",
        "recipient_phone": "015XXXXXXXX",
        "recipient_address": "House 3, Road 14, Dhanmondi, Dhaka-1205, Bangladesh",
        "delivery_type": 48,
        "item_type": 2,
        "item_quantity": 1,
        "item_weight": 0.5,
        "amount_to_collect": 200
      }
    ]
  }'
```

Each object in the `orders` array accepts the same fields as a single order creation request.

**Response (202)**

```json
{
  "message": "Your bulk order creation request is accepted, please wait some time to complete order creation.",
  "type": "success",
  "code": 202,
  "data": true
}
```

---

### Get Order Status

**`GET /aladdin/api/v1/orders/{consignment_id}/info`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/orders/DL121224VS8TTJ/info' \
  --header 'Authorization: Bearer {{access_token}}'
```

**Response (200)**

```json
{
  "message": "Order info",
  "type": "success",
  "code": 200,
  "data": {
    "consignment_id": "DL121224VS8TTJ",
    "merchant_order_id": "YOUR-ORDER-ID",
    "order_status": "Pending",
    "order_status_slug": "Pending",
    "updated_at": "2024-11-20 15:11:40",
    "invoice_id": null
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `consignment_id` | string | Pathao tracking ID |
| `merchant_order_id` | string | Your order ID |
| `order_status` | string | Human-readable status |
| `order_status_slug` | string | Machine-readable status |
| `updated_at` | string | Last update timestamp (`YYYY-MM-DD HH:MM:SS`) |
| `invoice_id` | string \| null | Invoice ID when payment is processed |

---

## Price Calculation

### Calculate Delivery Price

**`POST /aladdin/api/v1/merchant/price-plan`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/merchant/price-plan' \
  --header 'Content-Type: application/json; charset=UTF-8' \
  --header 'Authorization: Bearer {{access_token}}' \
  --data '{
    "store_id": 12345,
    "item_type": 2,
    "delivery_type": 48,
    "item_weight": 0.5,
    "recipient_city": 1,
    "recipient_zone": 1
  }'
```

**Request parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `store_id` | integer | Yes | Your store ID (sets pickup location) |
| `item_type` | integer | Yes | `1` = Document, `2` = Parcel |
| `delivery_type` | integer | Yes | `48` = Normal, `12` = On Demand |
| `item_weight` | float | Yes | Weight in kg, 0.5–10 |
| `recipient_city` | integer | Yes | Recipient city ID |
| `recipient_zone` | integer | Yes | Recipient zone ID |

**Response (200)**

```json
{
  "message": "price",
  "type": "success",
  "code": 200,
  "data": {
    "price": 80,
    "discount": 0,
    "promo_discount": 0,
    "plan_id": 69,
    "cod_enabled": 1,
    "cod_percentage": 0.01,
    "additional_charge": 0,
    "final_price": 80
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `price` | integer | Base delivery price (BDT) |
| `discount` | integer | Applied discount |
| `promo_discount` | integer | Promo discount |
| `plan_id` | integer | Price plan identifier |
| `cod_enabled` | integer | `1` = COD available, `0` = not available |
| `cod_percentage` | float | COD charge percentage (e.g. `0.01` = 1%) |
| `additional_charge` | integer | Any additional charges |
| `final_price` | number | Total price to charge (BDT) |

---

## Location

### Get Cities

**`GET /aladdin/api/v1/city-list`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/city-list' \
  --header 'Authorization: Bearer {{access_token}}'
```

**Response (200)**

```json
{
  "message": "City successfully fetched.",
  "type": "success",
  "code": 200,
  "data": {
    "data": [
      { "city_id": 1, "city_name": "Dhaka" },
      { "city_id": 2, "city_name": "Chittagong" },
      { "city_id": 4, "city_name": "Rajshahi" }
    ]
  }
}
```

---

### Get Zones

**`GET /aladdin/api/v1/cities/{city_id}/zone-list`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/cities/1/zone-list' \
  --header 'Authorization: Bearer {{access_token}}'
```

**Response (200)**

```json
{
  "message": "Zone list fetched.",
  "type": "success",
  "code": 200,
  "data": {
    "data": [
      { "zone_id": 298, "zone_name": "60 feet" },
      { "zone_id": 1070, "zone_name": "Abdullahpur Uttara" }
    ]
  }
}
```

---

### Get Areas

**`GET /aladdin/api/v1/zones/{zone_id}/area-list`**

```bash
curl --location '{{base_url}}/aladdin/api/v1/zones/298/area-list' \
  --header 'Authorization: Bearer {{access_token}}'
```

**Response (200)**

```json
{
  "message": "Area list fetched.",
  "type": "success",
  "code": 200,
  "data": {
    "data": [
      {
        "area_id": 37,
        "area_name": "Bonolota",
        "home_delivery_available": true,
        "pickup_available": true
      }
    ]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `area_id` | integer | Unique area identifier |
| `area_name` | string | Area name |
| `home_delivery_available` | boolean | Whether home delivery is available |
| `pickup_available` | boolean | Whether pickup is available |

---

## Enums

### Delivery Type

| Value | Constant | Description |
|-------|----------|-------------|
| `48` | `DeliveryType.NORMAL` | Standard delivery |
| `12` | `DeliveryType.ON_DEMAND` | On-demand / express delivery |

### Item Type

| Value | Constant | Description |
|-------|----------|-------------|
| `1` | `ItemType.DOCUMENT` | Document |
| `2` | `ItemType.PARCEL` | Parcel |
