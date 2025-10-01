# Pathao Merchant API SDK

[![npm version](https://badge.fury.io/js/%40sifat07%2Fpathao-merchant-sdk.svg)](https://badge.fury.io/js/%40sifat07%2Fpathao-merchant-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An **unofficial** TypeScript SDK for integrating with the Pathao Merchant API. This community package provides a clean, type-safe interface for all Pathao Merchant API operations including order management, store management, price calculation, and more.

> **Disclaimer**: This is not an official package from Pathao. It's a community-maintained SDK based on the public Pathao Merchant API documentation.

## Features

- 🚀 **Full TypeScript Support** - Complete type definitions for all API responses
- 🔐 **Automatic Authentication** - Handles OAuth2 token management and refresh
- 📦 **Order Management** - Create, track, and manage delivery orders
- 🏪 **Store Management** - Create and manage pickup/service points
- 💰 **Price Calculation** - Get accurate delivery charges before creating orders
- 🌍 **Location Services** - Access cities, zones, and areas data
- ⚡ **Built with Axios** - Reliable HTTP client with request/response interceptors
- 🛡️ **Error Handling** - Comprehensive error handling with detailed error messages
- 📚 **Well Documented** - Extensive documentation and examples

## Installation

```bash
npm install @sifat07/pathao-merchant-sdk
# or
yarn add @sifat07/pathao-merchant-sdk
# or
pnpm add @sifat07/pathao-merchant-sdk
```

## Quick Start

```typescript
import { PathaoApiService, DeliveryType, ItemType } from '@sifat07/pathao-merchant-sdk';

// Initialize the SDK
const pathao = new PathaoApiService({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  username: 'your-username',
  password: 'your-password'
});

// Create a delivery order
const order = await pathao.createOrder({
  store_id: 123,
  recipient_name: 'John Doe',
  recipient_phone: '01712345678',
  recipient_address: '123 Main Street, Dhanmondi, Dhaka',
  delivery_type: DeliveryType.NORMAL,
  item_type: ItemType.PARCEL,
  item_quantity: 1,
  item_weight: 1.0,
  amount_to_collect: 500
});

console.log('Order created:', order.data.consignment_id);
```

## API Reference

### Configuration

```typescript
interface PathaoConfig {
  clientId: string;        // Your Pathao API client ID
  clientSecret: string;    // Your Pathao API client secret
  username: string;        // Your Pathao API username
  password: string;        // Your Pathao API password
  baseURL?: string;        // API base URL (default: https://api-hermes.pathao.com)
  timeout?: number;        // Request timeout in ms (default: 30000)
}
```

### Order Management

#### Create Order

```typescript
const order = await pathao.createOrder({
  store_id: 123,
  merchant_order_id: 'ORDER-123', // Optional: Your order tracking ID
  recipient_name: 'John Doe',
  recipient_phone: '01712345678',
  recipient_secondary_phone: '01712345679', // Optional
  recipient_address: '123 Main Street, Dhanmondi',
  recipient_city: 1, // Optional: Auto-detected if not provided
  recipient_zone: 1, // Optional: Auto-detected if not provided
  recipient_area: 1, // Optional: Auto-detected if not provided
  delivery_type: DeliveryType.NORMAL, // 48 for Normal, 12 for On Demand
  item_type: ItemType.PARCEL, // 1 for Document, 2 for Parcel
  special_instruction: 'Call before delivery', // Optional
  item_quantity: 1,
  item_weight: 1.0, // 0.5-10 kg
  item_description: 'Electronics', // Optional
  amount_to_collect: 500 // COD amount (0 for non-COD)
});
```

#### Get Order Status

```typescript
const status = await pathao.getOrderStatus('consignment-id');
console.log('Order status:', status.data.status);
```

### Store Management

#### Create Store

```typescript
const store = await pathao.createStore({
  name: 'My Store',
  contact_name: 'Store Manager',
  contact_number: '01712345678',
  address: '123 Store Street, Dhanmondi',
  city_id: 1,
  zone_id: 1,
  area_id: 1,
  store_type: StoreType.PICKUP_POINT // 1 for Pickup Point, 2 for Service Point
});
```

#### Get Stores

```typescript
const stores = await pathao.getStores();
console.log('Available stores:', stores);
```

### Price Calculation

```typescript
const price = await pathao.calculatePrice({
  store_id: 123,
  item_type: ItemType.PARCEL,
  item_weight: 1.0,
  delivery_type: DeliveryType.NORMAL,
  recipient_city: 1,
  recipient_zone: 1,
  recipient_area: 1
});

console.log('Delivery charge:', price.data.delivery_charge);
console.log('COD charge:', price.data.cod_charge);
console.log('Total charge:', price.data.total_charge);
```

### Location Services

#### Get Cities

```typescript
const cities = await pathao.getCities();
console.log('Available cities:', cities.data);
```

#### Get Areas

```typescript
const areas = await pathao.getAreas();
console.log('Available areas:', areas.data);
```

### Validation Helpers

The SDK includes built-in validation helpers:

```typescript
import { PathaoApiService } from '@sifat07/pathao-merchant-sdk';

// Validate phone number
const isValidPhone = PathaoApiService.validatePhoneNumber('01712345678'); // true

// Format phone number
const formattedPhone = PathaoApiService.formatPhoneNumber('01712345678'); // '01712345678'

// Validate address
const isValidAddress = PathaoApiService.validateAddress('123 Main Street'); // true

// Validate weight
const isValidWeight = PathaoApiService.validateWeight(1.0); // true

// Validate recipient name
const isValidName = PathaoApiService.validateRecipientName('John Doe'); // true
```

## Enums

### DeliveryType

```typescript
enum DeliveryType {
  NORMAL = 48,    // Normal delivery
  ON_DEMAND = 12  // On-demand delivery
}
```

### ItemType

```typescript
enum ItemType {
  DOCUMENT = 1,   // Document
  PARCEL = 2      // Parcel
}
```

### StoreType

```typescript
enum StoreType {
  PICKUP_POINT = 1,   // Pickup Point
  SERVICE_POINT = 2   // Service Point
}
```

## Error Handling

The SDK provides comprehensive error handling with detailed error messages:

```typescript
try {
  const order = await pathao.createOrder(orderData);
} catch (error) {
  console.error('Order creation failed:', error.message);
  
  // Check if it's a Pathao API error
  if (error.response?.data) {
    console.error('API Error:', error.response.data);
  }
}
```

## Authentication

The SDK automatically handles OAuth2 authentication and token refresh. You only need to provide your credentials once during initialization:

```typescript
const pathao = new PathaoApiService({
  clientId: process.env.PATHAO_CLIENT_ID,
  clientSecret: process.env.PATHAO_CLIENT_SECRET,
  username: process.env.PATHAO_USERNAME,
  password: process.env.PATHAO_PASSWORD
});
```

## Environment Variables

Create a `.env` file with your Pathao API credentials:

```env
PATHAO_CLIENT_ID=your-client-id
PATHAO_CLIENT_SECRET=your-client-secret
PATHAO_USERNAME=your-username
PATHAO_PASSWORD=your-password
```

## Examples

### Complete Order Flow

```typescript
import { PathaoApiService, DeliveryType, ItemType } from '@sifat07/pathao-merchant-sdk';

async function createDeliveryOrder() {
  const pathao = new PathaoApiService({
    clientId: process.env.PATHAO_CLIENT_ID!,
    clientSecret: process.env.PATHAO_CLIENT_SECRET!,
    username: process.env.PATHAO_USERNAME!,
    password: process.env.PATHAO_PASSWORD!
  });

  try {
    // 1. Calculate price first
    const price = await pathao.calculatePrice({
      store_id: 123,
      item_type: ItemType.PARCEL,
      item_weight: 1.0,
      delivery_type: DeliveryType.NORMAL,
      recipient_city: 1,
      recipient_zone: 1,
      recipient_area: 1
    });

    console.log('Estimated cost:', price.data.total_charge);

    // 2. Create the order
    const order = await pathao.createOrder({
      store_id: 123,
      merchant_order_id: `ORDER-${Date.now()}`,
      recipient_name: 'John Doe',
      recipient_phone: '01712345678',
      recipient_address: '123 Main Street, Dhanmondi, Dhaka',
      delivery_type: DeliveryType.NORMAL,
      item_type: ItemType.PARCEL,
      item_quantity: 1,
      item_weight: 1.0,
      amount_to_collect: 500
    });

    console.log('Order created successfully:', {
      consignmentId: order.data.consignment_id,
      invoiceId: order.data.invoice_id,
      status: order.data.status
    });

    // 3. Track the order
    const status = await pathao.getOrderStatus(order.data.consignment_id);
    console.log('Current status:', status.data.status);

  } catch (error) {
    console.error('Delivery order failed:', error.message);
  }
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue on GitHub or contact me at sifatjasim@gmail.com.

## Disclaimer

This is an **unofficial** SDK and is not affiliated with or endorsed by Pathao. Use at your own risk. The maintainers are not responsible for any issues that may arise from using this package.

## Changelog

### 1.0.0
- Initial release
- Complete Pathao API integration
- TypeScript support
- Automatic authentication
- Order management
- Store management
- Price calculation
- Location services
