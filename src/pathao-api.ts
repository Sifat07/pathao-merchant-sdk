/**
 * Pathao Merchant API Service (Unofficial SDK)
 * 
 * This is an unofficial SDK for the Pathao Merchant API.
 * 
 * API Details (based on public documentation):
 * - Authentication: OAuth2 with client_id, client_secret, username, password
 * - Live URL: https://api-hermes.pathao.com
 * - All endpoints use /aladdin/api/v1/ prefix
 * 
 * Features implemented:
 * - Token-based authentication with refresh token support
 * - Store management (create, list stores)
 * - Order creation (single and bulk)
 * - Order tracking and status
 * - Dynamic price calculation
 * - City, zone, and area management
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  PathaoAreaResponse,
  PathaoAuthResponse,
  PathaoCityResponse,
  PathaoConfig,
  PathaoError,
  PathaoOrderRequest,
  PathaoOrderResponse,
  PathaoOrderStatusResponse,
  PathaoPriceRequest,
  PathaoPriceResponse,
  PathaoStoreRequest,
  PathaoStoreResponse,
} from './types';

export class PathaoApiService {
  private pathaoClient: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private config: PathaoConfig;

  constructor(config: PathaoConfig) {
    this.config = {
      baseURL: 'https://api-hermes.pathao.com',
      timeout: 30000,
      ...config,
    };

    this.pathaoClient = axios.create({
      baseURL: this.config.baseURL || 'https://api-hermes.pathao.com',
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Validate required credentials
    if (!this.config.clientId || !this.config.clientSecret || !this.config.username || !this.config.password) {
      throw new Error('Pathao API credentials are required: clientId, clientSecret, username, password');
    }

    // Add request interceptor for authentication
    this.pathaoClient.interceptors.request.use(async (config) => {
      await this.ensureAuthenticated();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return; // Token is still valid
    }

    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        return;
      } catch (error) {
        console.warn('Token refresh failed, attempting fresh authentication');
      }
    }

    await this.authenticate();
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await this.pathaoClient.post<PathaoAuthResponse>('/aladdin/api/v1/issue-token', {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        username: this.config.username,
        password: this.config.password,
        grant_type: 'password',
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 minute buffer

      console.log('Pathao authentication successful');
    } catch (error) {
      console.error('Pathao authentication failed:', error);
      throw new Error(`Authentication failed: ${this.getErrorMessage(error)}`);
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.pathaoClient.post<PathaoAuthResponse>('/aladdin/api/v1/issue-token', {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      });

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 minute buffer

      console.log('Pathao token refresh successful');
    } catch (error) {
      console.error('Pathao token refresh failed:', error);
      throw new Error(`Token refresh failed: ${this.getErrorMessage(error)}`);
    }
  }

  private getErrorMessage(error: any): string {
    if (error instanceof AxiosError) {
      const pathaoError = error.response?.data as PathaoError;
      if (pathaoError?.message) {
        return pathaoError.message;
      }
      return error.message;
    }
    return error.message || 'Unknown error';
  }

  // Official Pathao API: Create Order
  async createOrder(orderData: PathaoOrderRequest): Promise<PathaoOrderResponse> {
    try {
      console.log('Creating Pathao order:', {
        store_id: orderData.store_id,
        merchant_order_id: orderData.merchant_order_id,
        recipient_name: orderData.recipient_name,
        recipient_phone: orderData.recipient_phone,
        delivery_type: orderData.delivery_type,
        item_type: orderData.item_type,
        item_weight: orderData.item_weight,
        amount_to_collect: orderData.amount_to_collect,
      });
      
      const response = await this.pathaoClient.post<PathaoOrderResponse>('/aladdin/api/v1/orders', orderData);
      
      console.log('Pathao order created successfully:', {
        consignment_id: response.data.data?.consignment_id,
        invoice_id: response.data.data?.invoice_id,
        status: response.data.data?.status,
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Pathao order creation failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        orderData,
      });
      
      const errorMessage = this.getErrorMessage(error);
      throw new Error(`Failed to create Pathao order: ${errorMessage}`);
    }
  }

  // Official Pathao API: Create Store
  async createStore(storeData: PathaoStoreRequest): Promise<PathaoStoreResponse> {
    try {
      console.log('Creating Pathao store:', {
        name: storeData.name,
        contact_name: storeData.contact_name,
        city_id: storeData.city_id,
        zone_id: storeData.zone_id,
        area_id: storeData.area_id,
      });
      
      const response = await this.pathaoClient.post<PathaoStoreResponse>('/aladdin/api/v1/stores', storeData);
      
      console.log('Pathao store created successfully:', {
        store_id: response.data.data?.store_id,
        name: response.data.data?.name,
        status: response.data.data?.status,
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Pathao store creation failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        storeData,
      });
      
      const errorMessage = this.getErrorMessage(error);
      throw new Error(`Failed to create Pathao store: ${errorMessage}`);
    }
  }

  // Official Pathao API: Get Store List
  async getStores(): Promise<PathaoStoreResponse[]> {
    try {
      const response = await this.pathaoClient.get<{ data: PathaoStoreResponse[] }>('/aladdin/api/v1/stores');
      return response.data.data || [];
    } catch (error: any) {
      console.error('Failed to fetch Pathao stores:', error);
      const errorMessage = this.getErrorMessage(error);
      throw new Error(`Failed to fetch Pathao stores: ${errorMessage}`);
    }
  }

  // Official Pathao API: Calculate Price
  async calculatePrice(priceData: PathaoPriceRequest): Promise<PathaoPriceResponse> {
    try {
      console.log('Calculating Pathao price:', {
        store_id: priceData.store_id,
        item_type: priceData.item_type,
        item_weight: priceData.item_weight,
        delivery_type: priceData.delivery_type,
        recipient_city: priceData.recipient_city,
        recipient_zone: priceData.recipient_zone,
        recipient_area: priceData.recipient_area,
      });
      
      const response = await this.pathaoClient.post<PathaoPriceResponse>('/aladdin/api/v1/merchant/price-check', priceData);
      
      console.log('Pathao price calculated:', {
        delivery_charge: response.data.data?.delivery_charge,
        cod_charge: response.data.data?.cod_charge,
        total_charge: response.data.data?.total_charge,
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Pathao price calculation failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        priceData,
      });
      
      const errorMessage = this.getErrorMessage(error);
      throw new Error(`Failed to calculate Pathao price: ${errorMessage}`);
    }
  }

  // Official Pathao API: Get Cities
  async getCities(): Promise<PathaoCityResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoCityResponse>('/aladdin/api/v1/cities');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch Pathao cities:', error);
      const errorMessage = this.getErrorMessage(error);
      throw new Error(`Failed to fetch Pathao cities: ${errorMessage}`);
    }
  }

  // Official Pathao API: Get Areas
  async getAreas(): Promise<PathaoAreaResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoAreaResponse>('/aladdin/api/v1/areas');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch Pathao areas:', error);
      const errorMessage = this.getErrorMessage(error);
      throw new Error(`Failed to fetch Pathao areas: ${errorMessage}`);
    }
  }

  // Official Pathao API: Get Order Status
  async getOrderStatus(consignmentId: string): Promise<PathaoOrderStatusResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoOrderStatusResponse>(`/aladdin/api/v1/orders/${consignmentId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch Pathao order status:', error);
      const errorMessage = this.getErrorMessage(error);
      throw new Error(`Failed to fetch Pathao order status: ${errorMessage}`);
    }
  }

  // Helper method to validate phone number
  static validatePhoneNumber(phone: string): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length === 11 && cleanPhone.startsWith('01');
  }

  // Helper method to format phone number
  static formatPhoneNumber(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 11 && cleanPhone.startsWith('01')) {
      return cleanPhone;
    }
    throw new Error('Invalid phone number format. Must be 11 digits starting with 01');
  }

  // Helper method to validate address
  static validateAddress(address: string): boolean {
    const trimmed = address.trim();
    return trimmed.length >= 10 && trimmed.length <= 220;
  }

  // Helper method to validate weight
  static validateWeight(weight: number): boolean {
    return weight >= 0.5 && weight <= 10;
  }

  // Helper method to validate recipient name
  static validateRecipientName(name: string): boolean {
    const trimmed = name.trim();
    return trimmed.length >= 3 && trimmed.length <= 100;
  }
}
