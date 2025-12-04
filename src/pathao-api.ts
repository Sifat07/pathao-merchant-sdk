/**
 * Pathao Merchant API Service (Unofficial SDK)
 * 
 * This is an unofficial SDK for the Pathao Merchant API.
 * 
 * API Details (based on public documentation):
 * - Authentication: OAuth2 with client_id, client_secret, username, password
 * - All endpoints use /aladdin/api/v1/ prefix
 * - Base URL can be set via PATHAO_BASE_URL environment variable or constructor config
 * - Timeout can be set via PATHAO_TIMEOUT environment variable or constructor config
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
  PathaoStoreCreateResponse,
  PathaoStoreListResponse,
  PathaoStoreRequest,
  PathaoZoneResponse,
} from './types';

export class PathaoApiError extends Error {
  status: number | undefined;
  code: number | undefined;
  type: string | undefined;
  errors: Record<string, string[]> | undefined;
  validation: Record<string, string[]> | undefined;
  responseData: unknown;

  constructor(message: string, options: {
    status?: number | undefined;
    code?: number | undefined;
    type?: string | undefined;
    errors?: Record<string, string[]> | undefined;
    validation?: Record<string, string[]> | undefined;
    responseData?: unknown;
  } = {}) {
    super(message);
    this.name = 'PathaoApiError';
    this.status = options.status;
    this.code = options.code;
    this.type = options.type;
    this.errors = options.errors;
    this.validation = options.validation;
    this.responseData = options.responseData;
  }
}

export class PathaoApiService {
  private pathaoClient: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private config: PathaoConfig;
  private isAuthenticating: boolean = false;
  private authPromise: Promise<void> | null = null;
  private requestQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  private circuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    threshold: 5,
    timeout: 60000, // 1 minute
    isOpen: false,
  };

  constructor(config: PathaoConfig) {
    this.config = {
      baseURL: config.baseURL || process.env.PATHAO_BASE_URL || '',
      timeout: config.timeout || parseInt(process.env.PATHAO_TIMEOUT || '30000', 10),
      clientId: config.clientId || process.env.PATHAO_CLIENT_ID || '',
      clientSecret: config.clientSecret || process.env.PATHAO_CLIENT_SECRET || '',
      username: config.username || process.env.PATHAO_USERNAME || '',
      password: config.password || process.env.PATHAO_PASSWORD || '',
    };

    this.pathaoClient = axios.create({
      baseURL: this.config.baseURL || process.env.PATHAO_BASE_URL || '',
      timeout: this.config.timeout || parseInt(process.env.PATHAO_TIMEOUT || '30000', 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Validate required configuration
    if (!this.config.baseURL) {
      throw new Error('Pathao API baseURL is required. You can provide it via constructor config or PATHAO_BASE_URL environment variable');
    }
    
    if (!this.config.clientId || !this.config.clientSecret || !this.config.username || !this.config.password) {
      throw new Error('Pathao API credentials are required: clientId, clientSecret, username, password. You can provide them via constructor config or environment variables (PATHAO_CLIENT_ID, PATHAO_CLIENT_SECRET, PATHAO_USERNAME, PATHAO_PASSWORD)');
    }

    // Add request interceptor for authentication
    this.pathaoClient.interceptors.request.use(async (config) => {
      // Skip auth for token requests to prevent infinite loops
      if (config.url?.includes('/issue-token')) {
        return config;
      }
      
      await this.ensureAuthenticated();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.pathaoClient.interceptors.response.use(
      (response) => {
        // Reset circuit breaker on successful request
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.isOpen = false;
        return response;
      },
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear tokens and retry
          this.accessToken = null;
          this.refreshToken = null;
          this.tokenExpiry = null;
          
          // Retry the request once
          if (error.config && !error.config._retry) {
            error.config._retry = true;
            await this.ensureAuthenticated();
            if (this.accessToken) {
              error.config.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return this.pathaoClient.request(error.config);
          }
        }
        
        // Handle circuit breaker
        this.handleCircuitBreaker();
        return Promise.reject(error);
      },
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    // Check circuit breaker
    if (this.circuitBreaker.isOpen) {
      if (Date.now() - this.circuitBreaker.lastFailureTime > this.circuitBreaker.timeout) {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
      } else {
        throw new Error('Circuit breaker is open. Too many authentication failures.');
      }
    }

    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return; // Token is still valid
    }

    // If already authenticating, wait for it to complete
    if (this.isAuthenticating && this.authPromise) {
      return this.authPromise;
    }

    // Start authentication process
    this.isAuthenticating = true;
    this.authPromise = this.performAuthentication();

    try {
      await this.authPromise;
    } finally {
      this.isAuthenticating = false;
      this.authPromise = null;
      // Process queued requests
      this.processRequestQueue();
    }
  }

  private async performAuthentication(): Promise<void> {
    if (this.refreshToken) {
      try {
        await this.refreshAccessToken();
        return;
      } catch (error) {
        // Refresh failed, try fresh authentication
        this.refreshToken = null;
      }
    }

    await this.authenticate();
  }

  private processRequestQueue(): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];
    
    queue.forEach(({ resolve }) => {
      try {
        resolve();
      } catch (error) {
        // Ignore errors in queued requests
      }
    });
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

      // Reset circuit breaker on successful auth
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.isOpen = false;
    } catch (error) {
      this.handleCircuitBreaker();
      throw this.toPathaoApiError(error, 'Authentication failed');
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

      // Reset circuit breaker on successful refresh
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.isOpen = false;
    } catch (error) {
      this.handleCircuitBreaker();
      throw this.toPathaoApiError(error, 'Token refresh failed');
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
      const pathaoError = error.response?.data as PathaoError;
      if (pathaoError?.message) {
        return pathaoError.message;
      }
      return error.message;
    }
    return (error as Error).message || 'Unknown error';
  }

  private toPathaoApiError(error: unknown, context: string): PathaoApiError {
    if (error instanceof PathaoApiError) {
      return error;
    }

    const messageFallback = this.getErrorMessage(error);
    const axiosLike = (error instanceof AxiosError) ? error : (typeof error === 'object' && error && 'response' in (error as any) ? error as AxiosError : null);
    if (axiosLike) {
      const pathaoError = axiosLike.response?.data as PathaoError | undefined;
      return new PathaoApiError(`${context}: ${pathaoError?.message || messageFallback}`, {
        status: axiosLike.response?.status,
        code: pathaoError?.code ?? axiosLike.response?.status,
        type: pathaoError?.type,
        errors: pathaoError?.errors,
        validation: pathaoError?.validation,
        responseData: pathaoError ?? axiosLike.response?.data,
      });
    }

    return new PathaoApiError(`${context}: ${messageFallback}`);
  }

  private handleCircuitBreaker(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
    }
  }

  // Official Pathao API: Create Order
  async createOrder(orderData: PathaoOrderRequest): Promise<PathaoOrderResponse> {
    try {
      const response = await this.pathaoClient.post<PathaoOrderResponse>('/aladdin/api/v1/orders', orderData);
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to create Pathao order');
    }
  }

  // Official Pathao API: Create Store
  async createStore(storeData: PathaoStoreRequest): Promise<PathaoStoreCreateResponse> {
    try {
      const response = await this.pathaoClient.post<PathaoStoreCreateResponse>('/aladdin/api/v1/stores', storeData);
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to create Pathao store');
    }
  }

  // Official Pathao API: Get Store List
  async getStores(): Promise<PathaoStoreListResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoStoreListResponse>('/aladdin/api/v1/stores');
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao stores');
    }
  }

  // Official Pathao API: Calculate Price
  async calculatePrice(priceData: PathaoPriceRequest): Promise<PathaoPriceResponse> {
    try {
      const response = await this.pathaoClient.post<PathaoPriceResponse>('/aladdin/api/v1/merchant/price-plan', priceData);
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to calculate Pathao price');
    }
  }

  // Official Pathao API: Get Cities
  async getCities(): Promise<PathaoCityResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoCityResponse>('/aladdin/api/v1/city-list');
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao cities');
    }
  }

  // Official Pathao API: Get Zones for a City
  async getZones(cityId: number): Promise<PathaoZoneResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoZoneResponse>(`/aladdin/api/v1/cities/${cityId}/zone-list`);
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao zones');
    }
  }

  // Official Pathao API: Get Areas for a Zone
  async getAreas(zoneId: number): Promise<PathaoAreaResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoAreaResponse>(`/aladdin/api/v1/zones/${zoneId}/area-list`);
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao areas');
    }
  }

  // Official Pathao API: Get Order Status
  async getOrderStatus(consignmentId: string): Promise<PathaoOrderStatusResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoOrderStatusResponse>(`/aladdin/api/v1/orders/${consignmentId}/info`);
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao order status');
    }
  }

  // Official Pathao API: Create Bulk Order
  async createBulkOrder(
    orders: PathaoOrderRequest[],
  ): Promise<{ message: string; type: string; code: number; data: boolean }> {
    try {
      const response = await this.pathaoClient.post<{
        message: string;
        type: string;
        code: number;
        data: boolean;
      }>('/aladdin/api/v1/orders/bulk', { orders });
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to create bulk Pathao orders');
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

  // Helper method to validate store name
  static validateStoreName(name: string): boolean {
    const trimmed = name.trim();
    return trimmed.length >= 3 && trimmed.length <= 50;
  }

  // Helper method to validate contact name
  static validateContactName(name: string): boolean {
    const trimmed = name.trim();
    return trimmed.length >= 3 && trimmed.length <= 50;
  }

  // Helper method to validate contact number
  static validateContactNumber(phone: string): boolean {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length === 11;
  }

  // Helper method to validate store address
  static validateStoreAddress(address: string): boolean {
    const trimmed = address.trim();
    return trimmed.length >= 15 && trimmed.length <= 120;
  }

  // Method to clear authentication state (useful for testing)
  clearAuth(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.isAuthenticating = false;
    this.authPromise = null;
    this.requestQueue = [];
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      threshold: 5,
      timeout: 60000,
      isOpen: false,
    };
  }
}
