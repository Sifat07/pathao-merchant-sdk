/**
 * Pathao Courier API Types
 * 
 * Official API Details:
 * - Authentication: OAuth2 with client_id, client_secret, username, password
 * - Live URL: https://api-hermes.pathao.com
 * - All endpoints use /aladdin/api/v1/ prefix
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
  name: string;
  contact_name: string;
  contact_number: string;
  address: string;
  city_id: number;
  zone_id: number;
  area_id: number;
  store_type: number;                  // 1 (Pickup Point), 2 (Service Point)
}

// Official Pathao Order Response
export interface PathaoOrderResponse {
  type: string;
  code: number;
  message: string;
  data: {
    consignment_id: string;
    invoice_id: string;
    merchant_order_id: string;
    store_id: number;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    recipient_city: string;
    recipient_zone: string;
    recipient_area: string;
    delivery_type: string;
    item_type: string;
    item_quantity: number;
    item_weight: number;
    item_description: string;
    amount_to_collect: number;
    special_instruction: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
}

// Official Pathao Store Response
export interface PathaoStoreResponse {
  type: string;
  code: number;
  message: string;
  data: {
    store_id: number;
    name: string;
    contact_name: string;
    contact_number: string;
    address: string;
    city_id: number;
    zone_id: number;
    area_id: number;
    store_type: number;
    status: string;
    created_at: string;
    updated_at: string;
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
    store_id: number;
    item_type: string;
    item_weight: number;
    delivery_type: string;
    recipient_city: string;
    recipient_zone: string;
    recipient_area: string;
    delivery_charge: number;
    cod_charge: number;
    total_charge: number;
    currency: string;
  };
}

// Official Pathao City Response
export interface PathaoCityResponse {
  type: string;
  code: number;
  message: string;
  data: Array<{
    city_id: number;
    city_name: string;
    zone_list: Array<{
      zone_id: number;
      zone_name: string;
      area_list: Array<{
        area_id: number;
        area_name: string;
      }>;
    }>;
  }>;
}

// Official Pathao Order Status Response
export interface PathaoOrderStatusResponse {
  type: string;
  code: number;
  message: string;
  data: {
    consignment_id: string;
    invoice_id: string;
    merchant_order_id: string;
    store_id: number;
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
    recipient_city: string;
    recipient_zone: string;
    recipient_area: string;
    delivery_type: string;
    item_type: string;
    item_quantity: number;
    item_weight: number;
    item_description: string;
    amount_to_collect: number;
    special_instruction: string;
    status: string;
    status_updated_at: string;
    created_at: string;
    updated_at: string;
  };
}

// Official Pathao Area Response
export interface PathaoAreaResponse {
  type: string;
  code: number;
  message: string;
  data: Array<{
    area_id: number;
    area_name: string;
    zone_id: number;
    zone_name: string;
    city_id: number;
    city_name: string;
  }>;
}

// Configuration options for PathaoApiService
export interface PathaoConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  baseURL?: string;
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

// Store types enum
export enum StoreType {
  PICKUP_POINT = 1,
  SERVICE_POINT = 2
}
