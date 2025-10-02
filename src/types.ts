/**
 * Pathao Courier API Types
 * 
 * Official API Details:
 * - Authentication: OAuth2 with client_id, client_secret, username, password
 * - All endpoints use /aladdin/api/v1/ prefix
 * - Base URL can be set via PATHAO_BASE_URL environment variable or constructor config
 * - Timeout can be set via PATHAO_TIMEOUT environment variable or constructor config
 */

// Official Pathao API Authentication Response
export interface PathaoAuthResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

// Official Pathao Order Creation Request
export interface PathaoOrderRequest {
  store_id: number;
  merchant_order_id?: string;          // Optional - Your order tracking ID
  recipient_name: string;              // Required - 3-100 characters
  recipient_phone: string;             // Required - 11 characters
  recipient_secondary_phone?: string;  // Optional - 11 characters
  recipient_address: string;           // Required - 10-220 characters
  recipient_city?: number;             // Optional - Auto-detected if not provided
  recipient_zone?: number;             // Optional - Auto-detected if not provided
  recipient_area?: number;             // Optional - Auto-detected if not provided
  delivery_type: number;               // Required - 48 (Normal), 12 (On Demand)
  item_type: number;                   // Required - 1 (Document), 2 (Parcel)
  special_instruction?: string;        // Optional
  item_quantity: number;               // Required
  item_weight: number;                 // Required - 0.5-10 kg
  item_description?: string;           // Optional
  amount_to_collect: number;           // Required - COD amount (0 for non-COD)
}

// Official Pathao Store Creation Request
export interface PathaoStoreRequest {
  name: string;                        // 3-50 characters
  contact_name: string;                // 3-50 characters
  contact_number: string;              // 11 characters
  secondary_contact?: string;          // Optional - 11 characters
  otp_number?: string;                 // Optional - OTP for orders
  address: string;                     // 15-120 characters
  city_id: number;
  zone_id: number;
  area_id: number;
}

// Official Pathao Order Response
export interface PathaoOrderResponse {
  type: string;
  code: number;
  message: string;
  data: {
    consignment_id: string;
    merchant_order_id: string;
    order_status: string;
    delivery_fee: number;
  };
}

// Official Pathao Store Response
export interface PathaoStoreResponse {
  type: string;
  code: number;
  message: string;
  data: {
    store_id: number;
    store_name: string;
    store_address: string;
    is_active: number;                 // 1 for active, 0 for deactivated
    city_id: number;
    zone_id: number;
    hub_id: number;
    is_default_store: boolean;
    is_default_return_store: boolean;
  };
}

// Official Pathao Price Calculation Request
export interface PathaoPriceRequest {
  store_id: number;
  item_type: number;
  item_weight: number;
  delivery_type: number;
  recipient_city: number;
  recipient_zone: number;
  recipient_area: number;
}

// Official Pathao Price Response
export interface PathaoPriceResponse {
  type: string;
  code: number;
  message: string;
  data: {
    price: number;                     // Calculated price for given item
    discount: number;                  // Discount for the given item
    promo_discount: number;           // Promo discount for the given item
    plan_id: number;                  // Price plan id for the given item
    cod_enabled: number;              // 1 if COD enabled, 0 if not
    cod_percentage: number;           // Cash on delivery percentage
    additional_charge: number;        // If there is any additional charge
    final_price: number;              // Your final price for the given item
  };
}

// Official Pathao City Response
export interface PathaoCityResponse {
  type: string;
  code: number;
  message: string;
  data: {
    data: Array<{
      city_id: number;
      city_name: string;
    }>;
  };
}

// Official Pathao Order Status Response
export interface PathaoOrderStatusResponse {
  type: string;
  code: number;
  message: string;
  data: {
    consignment_id: string;
    merchant_order_id: string;
    order_status: string;
    order_status_slug: string;
    updated_at: string;
    invoice_id: string | null;
  };
}

// Official Pathao Zone Response
export interface PathaoZoneResponse {
  type: string;
  code: number;
  message: string;
  data: {
    data: Array<{
      zone_id: number;
      zone_name: string;
    }>;
  };
}

// Official Pathao Area Response
export interface PathaoAreaResponse {
  type: string;
  code: number;
  message: string;
  data: {
    data: Array<{
      area_id: number;
      area_name: string;
      home_delivery_available: boolean;
      pickup_available: boolean;
    }>;
  };
}

// Configuration options for PathaoApiService
export interface PathaoConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  baseURL: string;
  timeout?: number;
}

// Error response from Pathao API
export interface PathaoError {
  type: string;
  code: number;
  message: string;
  errors?: Record<string, string[]>;
  validation?: Record<string, string[]>;
}

// Delivery types enum
export enum DeliveryType {
  NORMAL = 48,
  ON_DEMAND = 12
}

// Item types enum
export enum ItemType {
  DOCUMENT = 1,
  PARCEL = 2
}

// Store types enum (removed as not used in official API)
// export enum StoreType {
//   PICKUP_POINT = 1,
//   SERVICE_POINT = 2
// }
