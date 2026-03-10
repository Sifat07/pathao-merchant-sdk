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
  PathaoBulkOrderResponse,
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

  constructor(
    message: string,
    options: {
      status?: number | undefined;
      code?: number | undefined;
      type?: string | undefined;
      errors?: Record<string, string[]> | undefined;
      validation?: Record<string, string[]> | undefined;
      responseData?: unknown;
    } = {},
  ) {
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

// Internal resolved config with guaranteed timeout
interface ResolvedPathaoConfig extends PathaoConfig {
  timeout: number;
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  threshold?: number;  // Default: 5
  timeout?: number;    // Default: 60000ms
}

export class PathaoApiService {
  private pathaoClient: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private config: ResolvedPathaoConfig;
  private isAuthenticating: boolean = false;
  private authPromise: Promise<void> | null = null;
  private hasValidated: boolean = false;
  private debug: boolean = false;
  private circuitBreaker: {
    failures: number;
    lastFailureTime: number;
    threshold: number;
    timeout: number;
    isOpen: boolean;
  };

  constructor(config: PathaoConfig, options?: { debug?: boolean; circuitBreaker?: CircuitBreakerConfig }) {
    const parsedTimeout = parseInt(process.env.PATHAO_TIMEOUT || '', 10);
    const envTimeout = Number.isNaN(parsedTimeout) || parsedTimeout <= 0 ? 30000 : parsedTimeout;
    const timeout: number = config.timeout ?? envTimeout;

    this.config = {
      baseURL: config.baseURL || process.env.PATHAO_BASE_URL || '',
      timeout,
      clientId: config.clientId || process.env.PATHAO_CLIENT_ID || '',
      clientSecret:
        config.clientSecret || process.env.PATHAO_CLIENT_SECRET || '',
      username: config.username || process.env.PATHAO_USERNAME || '',
      password: config.password || process.env.PATHAO_PASSWORD || '',
    };

    this.debug = options?.debug || false;
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      threshold: options?.circuitBreaker?.threshold ?? 5,
      timeout: options?.circuitBreaker?.timeout ?? 60000,
      isOpen: false,
    };

    this.pathaoClient = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': `pathao-merchant-sdk node/${  process.version}`,
      },
    });

    // Add request interceptor for authentication
    this.pathaoClient.interceptors.request.use(async (config) => {
      // Skip auth for token requests to prevent infinite loops
      if (config.url?.includes('/issue-token')) {
        return config;
      }

      // Validate configuration on first API call
      this.validateConfiguration();
      await this.ensureAuthenticated();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }

      if (this.debug) {
        const safeHeaders = { ...config.headers } as Record<string, unknown>;
        if (safeHeaders['Authorization']) safeHeaders['Authorization'] = 'Bearer [REDACTED]';
        console.log(`[Pathao SDK] ${config.method?.toUpperCase()} ${config.url}`, {
          headers: safeHeaders,
          data: config.data,
        });
      }

      return config;
    });

    // Add response interceptor for error handling
    this.pathaoClient.interceptors.response.use(
      (response) => {
        // Reset circuit breaker on successful request
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.isOpen = false;

        if (this.debug) {
          console.log(`[Pathao SDK] Response ${response.status}`, {
            url: response.config.url,
            data: response.data,
          });
        }

        return response;
      },
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear tokens and retry once
          this.accessToken = null;
          this.refreshToken = null;
          this.tokenExpiry = null;

          if (error.config && !error.config._retry) {
            error.config._retry = true;
            await this.ensureAuthenticated();
            if (this.accessToken) {
              error.config.headers.Authorization = `Bearer ${this.accessToken}`;
            }
            return this.pathaoClient.request(error.config);
          }
        }

        // Respect Retry-After on 429 (rate limit), retry once
        if (error.response?.status === 429 && error.config && !error.config._rateLimitRetry) {
          error.config._rateLimitRetry = true;
          const retryAfterHeader = error.response.headers['retry-after'] as string | undefined;
          const delayMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 1000;
          await this.delay(delayMs);
          return this.pathaoClient.request(error.config);
        }

        // Retry transient 5xx errors with exponential backoff (max 2 retries)
        const status: number | undefined = error.response?.status;
        if (status !== undefined && status >= 500 && error.config) {
          const retryCount: number = (error.config._retryCount as number | undefined) ?? 0;
          if (retryCount < 2) {
            error.config._retryCount = retryCount + 1;
            await this.delay(Math.min(500 * 2 ** retryCount, 4000));
            return this.pathaoClient.request(error.config);
          }
        }

        // Handle circuit breaker
        this.handleCircuitBreaker();
        return Promise.reject(error);
      },
    );
  }

  private validateConfiguration(): void {
    // Only validate once
    if (this.hasValidated) {
      return;
    }

    if (!this.config.baseURL) {
      throw this.toPathaoApiError(
        new Error(
          'Pathao API baseURL is required. You can provide it via constructor config or PATHAO_BASE_URL environment variable',
        ),
        'Configuration validation failed',
      );
    }

    if (!this.config.baseURL.startsWith('https://')) {
      throw this.toPathaoApiError(
        new Error('Pathao API baseURL must use HTTPS (https://)'),
        'Configuration validation failed',
      );
    }

    if (
      !this.config.clientId ||
      !this.config.clientSecret ||
      !this.config.username ||
      !this.config.password
    ) {
      throw this.toPathaoApiError(
        new Error(
          'Pathao API credentials are required: clientId, clientSecret, username, password. You can provide them via constructor config or environment variables (PATHAO_CLIENT_ID, PATHAO_CLIENT_SECRET, PATHAO_USERNAME, PATHAO_PASSWORD)',
        ),
        'Configuration validation failed',
      );
    }

    this.hasValidated = true;
  }

  private async ensureAuthenticated(): Promise<void> {
    // Check circuit breaker
    if (this.circuitBreaker.isOpen) {
      if (
        Date.now() - this.circuitBreaker.lastFailureTime >
        this.circuitBreaker.timeout
      ) {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
      } else {
        throw new PathaoApiError(
          'Circuit breaker is open. Too many authentication failures. Try again later.',
          { code: 503 },
        );
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

  private async authenticate(): Promise<void> {
    try {
      const response = await this.pathaoClient.post<PathaoAuthResponse>(
        '/aladdin/api/v1/issue-token',
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          username: this.config.username,
          password: this.config.password,
          grant_type: 'password',
        },
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000; // 1 minute buffer

      // Reset circuit breaker on successful auth
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.isOpen = false;
    } catch (error) {
      this.handleCircuitBreaker();
      throw this.toPathaoApiError(error, 'Authentication failed');
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await this.pathaoClient.post<PathaoAuthResponse>(
        '/aladdin/api/v1/issue-token',
        {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        },
      );

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000; // 1 minute buffer

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
    if (error instanceof Error) return error.message;
    return 'Unknown error';
  }

  private toPathaoApiError(error: unknown, context: string): PathaoApiError {
    if (error instanceof PathaoApiError) {
      return error;
    }

    const messageFallback = this.getErrorMessage(error);
    const hasResponse = (e: unknown): e is { response?: AxiosError['response'] } =>
      typeof e === 'object' && e !== null && 'response' in e;
    const axiosLike =
      error instanceof AxiosError
        ? error
        : hasResponse(error)
          ? error
          : null;
    if (axiosLike) {
      const pathaoError = axiosLike.response?.data as PathaoError | undefined;
      return new PathaoApiError(
        `${context}: ${pathaoError?.message || messageFallback}`,
        {
          status: axiosLike.response?.status,
          code: pathaoError?.code ?? axiosLike.response?.status,
          type: pathaoError?.type,
          errors: pathaoError?.errors,
          validation: pathaoError?.validation,
          responseData: pathaoError ?? axiosLike.response?.data,
        },
      );
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Official Pathao API: Create Order
  async createOrder(
    orderData: PathaoOrderRequest,
  ): Promise<PathaoOrderResponse> {
    try {
      const response = await this.pathaoClient.post<PathaoOrderResponse>(
        '/aladdin/api/v1/orders',
        orderData,
      );
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to create Pathao order');
    }
  }

  // Official Pathao API: Create Store
  async createStore(
    storeData: PathaoStoreRequest,
  ): Promise<PathaoStoreCreateResponse> {
    try {
      const response = await this.pathaoClient.post<PathaoStoreCreateResponse>(
        '/aladdin/api/v1/stores',
        storeData,
      );
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to create Pathao store');
    }
  }

  // Official Pathao API: Get Store List
  async getStores(page?: number): Promise<PathaoStoreListResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoStoreListResponse>(
        '/aladdin/api/v1/stores',
        page !== undefined ? { params: { page } } : undefined,
      );
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao stores');
    }
  }

  // Official Pathao API: Calculate Price
  async calculatePrice(
    priceData: PathaoPriceRequest,
  ): Promise<PathaoPriceResponse> {
    try {
      const response = await this.pathaoClient.post<PathaoPriceResponse>(
        '/aladdin/api/v1/merchant/price-plan',
        priceData,
      );
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to calculate Pathao price');
    }
  }

  // Official Pathao API: Get Cities
  async getCities(): Promise<PathaoCityResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoCityResponse>(
        '/aladdin/api/v1/city-list',
      );
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao cities');
    }
  }

  // Official Pathao API: Get Zones for a City
  async getZones(cityId: number): Promise<PathaoZoneResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoZoneResponse>(
        `/aladdin/api/v1/cities/${cityId}/zone-list`,
      );
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao zones');
    }
  }

  // Official Pathao API: Get Areas for a Zone
  async getAreas(zoneId: number): Promise<PathaoAreaResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoAreaResponse>(
        `/aladdin/api/v1/zones/${zoneId}/area-list`,
      );
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao areas');
    }
  }

  // Official Pathao API: Get Order Status
  async getOrderStatus(
    consignmentId: string,
  ): Promise<PathaoOrderStatusResponse> {
    try {
      const response = await this.pathaoClient.get<PathaoOrderStatusResponse>(
        `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`,
      );
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao order status');
    }
  }

  // Official Pathao API: Create Bulk Order
  async createBulkOrder(
    orders: PathaoOrderRequest[],
  ): Promise<PathaoBulkOrderResponse> {
    try {
      const response = await this.pathaoClient.post<PathaoBulkOrderResponse>(
        '/aladdin/api/v1/orders/bulk', { orders });
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
    throw new Error(
      'Invalid phone number format. Must be 11 digits starting with 01',
    );
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
    return cleanPhone.length === 11 && cleanPhone.startsWith('01');
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
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.lastFailureTime = 0;
  }

  // Static factory method to create instance from environment variables
  static fromEnv(options?: { debug?: boolean; circuitBreaker?: CircuitBreakerConfig }): PathaoApiService {
    const config: PathaoConfig = {
      clientId: '',
      clientSecret: '',
      username: '',
      password: '',
      baseURL: '',
    };
    return new PathaoApiService(config, options);
  }

  // Static factory method to create instance from configuration object
  static fromConfig(
    config: PathaoConfig,
    options?: { debug?: boolean; circuitBreaker?: CircuitBreakerConfig },
  ): PathaoApiService {
    return new PathaoApiService(config, options);
  }

  // Named constructor for sandbox environment
  static sandbox(credentials: Omit<PathaoConfig, 'baseURL'>, options?: { debug?: boolean; circuitBreaker?: CircuitBreakerConfig }): PathaoApiService {
    return new PathaoApiService(
      { ...credentials, baseURL: 'https://courier-api-sandbox.pathao.com' },
      options,
    );
  }

  // Named constructor for production environment
  static production(credentials: Omit<PathaoConfig, 'baseURL'>, options?: { debug?: boolean; circuitBreaker?: CircuitBreakerConfig }): PathaoApiService {
    return new PathaoApiService(
      { ...credentials, baseURL: 'https://api-hermes.pathao.com' },
      options,
    );
  }
}

