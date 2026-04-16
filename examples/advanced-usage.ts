/**
 * Advanced usage examples for pathao-merchant-sdk
 *
 * Demonstrates:
 * - Factory methods (fromEnv, fromConfig)
 * - Debug logging
 * - Configurable circuit breaker
 * - Error handling with PathaoApiError
 */

import {
  DeliveryType,
  ItemType,
  PathaoApiError,
  PathaoApiService,
} from '../dist/index.js';

// ==========================================
// 1. Factory Methods
// ==========================================

// Create from environment variables (reads PATHAO_* env vars)
PathaoApiService.fromEnv();

// Create from environment with debug and custom circuit breaker
PathaoApiService.fromEnv({
  debug: true, // Enable debug logging
  circuitBreaker: {
    threshold: 10, // Allow 10 failures before opening circuit
    timeout: 120000, // Try again after 2 minutes
  },
});

// Create from explicit config with options
PathaoApiService.fromConfig(
  {
    baseURL: 'https://api-hermes.pathao.com',
    clientId: process.env.PATHAO_CLIENT_ID || '',
    clientSecret: process.env.PATHAO_CLIENT_SECRET || '',
    username: process.env.PATHAO_USERNAME || '',
    password: process.env.PATHAO_PASSWORD || '',
    timeout: 5000,
  },
  {
    debug: process.env.DEBUG === 'true',
    circuitBreaker: {
      threshold: 5,
      timeout: 60000,
    },
  },
);

// ==========================================
// 2. Constructor with options
// ==========================================

const pathao = new PathaoApiService(
  {
    clientId: process.env.PATHAO_CLIENT_ID || '',
    clientSecret: process.env.PATHAO_CLIENT_SECRET || '',
    username: process.env.PATHAO_USERNAME || '',
    password: process.env.PATHAO_PASSWORD || '',
    baseURL: process.env.PATHAO_BASE_URL || 'https://api-hermes.pathao.com',
  },
  {
    debug: true, // Log all requests/responses
    circuitBreaker: {
      threshold: 8,
      timeout: 90000,
    },
  },
);

// ==========================================
// 3. Error Handling Examples
// ==========================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function exampleErrorHandling() {
  try {
    const order = await pathao.createOrder({
      store_id: Number(process.env.PATHAO_STORE_ID),
      recipient_name: 'John Doe',
      recipient_phone: '01712345678',
      recipient_address: '123 Main Street, Dhaka',
      delivery_type: DeliveryType.NORMAL,
      item_type: ItemType.PARCEL,
      item_quantity: 1,
      item_weight: 1.0,
      amount_to_collect: 500,
    });

    console.log('Order created:', order.data.consignment_id);
  } catch (error) {
    // Type-safe error handling with PathaoApiError
    if (error instanceof PathaoApiError) {
      console.error('Pathao API Error:', {
        status: error.status, // HTTP status code
        code: error.code, // Pathao error code
        type: error.type, // Error type
        message: error.message, // Error message
        errors: error.errors, // Field-level errors
        validation: error.validation, // Validation errors
      });

      // Handle specific error cases
      if (error.status === 422) {
        console.error('Validation failed:', error.validation);
      } else if (error.status === 401) {
        console.error('Authentication failed:', error.message);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// ==========================================
// 4. Configuration Validation
// ==========================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function exampleDeferredValidation() {
  // SDK initializes successfully even without credentials
  const sdk = new PathaoApiService({
    clientId: '', // Empty!
    clientSecret: '',
    username: '',
    password: '',
    baseURL: '',
  });

  // Error only happens on first API call
  try {
    await sdk.getStores();
  } catch (error) {
    if (error instanceof PathaoApiError) {
      console.error('Configuration missing:', error.validation);
    }
  }
}

// ==========================================
// 5. Debug Logging Output Example
// ==========================================

// When debug is enabled, you'll see output like:
//
// [Pathao SDK] POST /aladdin/api/v1/orders {
//   headers: {
//     'Authorization': 'Bearer [REDACTED]',
//     'Content-Type': 'application/json'
//   },
//   data: {
//     store_id: 123,
//     recipient_name: 'John Doe',
//     ...
//   }
// }
// [Pathao SDK] Response 201 {
//   url: 'https://api-hermes.pathao.com/aladdin/api/v1/orders',
//   data: {
//     status: 1,
//     consignment_id: 'ABC123DEF456',
//     ...
//   }
// }

console.log('Advanced usage examples compiled successfully!');

// Export examples for documentation
export {
  exampleErrorHandling,
  exampleDeferredValidation,
  pathao,
};
