/**
 * Pathao Merchant API Service (Unofficial SDK)
 *
 * This is an unofficial SDK for the Pathao Merchant API.
 *
 * API Details (based on public documentation):
 * - Authentication: OAuth2 with client_id, client_secret, username, password
 * - All endpoints use /aladdin/api/v1/ prefix
 * - The constructor reads only the config it is given. Use fromEnv() to read
 *   PATHAO_* environment variables (including PATHAO_TIMEOUT).
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
  PathaoStore,
  PathaoStoreCreateResponse,
  PathaoStoreListResponse,
  PathaoStoreRequest,
  PathaoZoneResponse,
} from './types';

// GETs, token grants and the read-only price-plan POST can be repeated
// without side effects. Order and store creation cannot.
function isSafeToRetry(config: { method?: string | undefined; url?: string | undefined }): boolean {
  const url = config.url ?? '';
  return (
    config.method?.toLowerCase() === 'get' ||
    url.includes('/issue-token') ||
    url.includes('/merchant/price-plan')
  );
}

export type PathaoErrorKind =
  /** Input rejected, by this SDK before sending or by Pathao (HTTP 400/422). */
  | 'validation'
  /** Missing or wrong baseURL / credentials, caught before any request. */
  | 'config'
  /** Rejected credentials or token (HTTP 401). */
  | 'auth'
  /**
   * The account may not do this right now: HTTP 403, or 402 when Pathao
   * refuses new orders until the merchant pays outstanding dues.
   */
  | 'forbidden'
  /** Unknown consignment, store or resource (HTTP 404). */
  | 'not_found'
  /** HTTP 429. Back off; see PATHAO_RATE_LIMIT_PER_MINUTE. */
  | 'rate_limited'
  /** 5xx, timeout, network failure or open circuit breaker. */
  | 'unavailable'
  /** A response this SDK doesn't understand. Inspect `responseData`. */
  | 'unexpected';

function kindForStatus(status: number | undefined): PathaoErrorKind {
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'auth';
  if (status === 402 || status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status !== undefined && status >= 500) return 'unavailable';
  return 'unexpected';
}

export class PathaoApiError extends Error {
  kind: PathaoErrorKind;
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
      kind?: PathaoErrorKind | undefined;
    } = {},
  ) {
    super(message);
    this.name = 'PathaoApiError';
    this.kind = options.kind ?? kindForStatus(options.status ?? options.code);
    this.status = options.status;
    this.code = options.code;
    this.type = options.type;
    this.errors = options.errors;
    this.validation = options.validation;
    this.responseData = options.responseData;
  }

  /**
   * True for transient failures (`unavailable`, `rate_limited`). For
   * createOrder / createBulkOrder a 5xx may hide a booking that went through:
   * look the order up before retrying a create.
   */
  get retryable(): boolean {
    return this.kind === 'unavailable' || this.kind === 'rate_limited';
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

export interface PathaoClientOptions {
  /** Log requests and responses (tokens and Authorization redacted). */
  debug?: boolean;
  circuitBreaker?: CircuitBreakerConfig;
  /**
   * Minimum gap between requests from this instance, in ms. Requests queue
   * instead of tripping Pathao's 60/min limit (PATHAO_RATE_LIMIT_PER_MINUTE).
   * 1500 keeps one instance near 40/min, leaving headroom for other callers
   * sharing the credentials. Default 0 (no spacing).
   */
  minRequestIntervalMs?: number;
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
  private minRequestIntervalMs: number;
  private nextRequestAt = 0;
  private circuitBreaker: {
    failures: number;
    lastFailureTime: number;
    threshold: number;
    timeout: number;
    isOpen: boolean;
  };

  constructor(config: PathaoConfig, options?: PathaoClientOptions) {
    // Explicit config is read as given, never topped up from process.env: in
    // a multi-tenant app a blank field would otherwise pick up the platform's
    // own Pathao account. Env-based setup is fromEnv().
    this.config = {
      baseURL: config.baseURL ?? '',
      timeout: config.timeout ?? 30000,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password,
    };

    this.debug = options?.debug || false;
    this.minRequestIntervalMs = Math.max(0, options?.minRequestIntervalMs ?? 0);
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      threshold: options?.circuitBreaker?.threshold ?? 5,
      timeout: options?.circuitBreaker?.timeout ?? 60000,
      isOpen: false,
    };

    this.pathaoClient = axios.create({
      ...(this.config.baseURL ? { baseURL: this.config.baseURL } : {}),
      timeout: this.config.timeout,
      // Pathao has no reason to redirect, and a 307/308 would re-send the
      // issue-token body (client secret, password) to wherever it points.
      // With 0, any 3xx rejects like an error status.
      maxRedirects: 0,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': `pathao-merchant-sdk node/${process.version}`,
      },
    });

    // Add request interceptor for authentication
    this.pathaoClient.interceptors.request.use(async (config) => {
      // Every request counts against Pathao's limit, token grants and
      // retries included, so space them all.
      await this.waitForRequestSlot();

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
          // Token grants carry access_token / refresh_token; never log them.
          const isTokenResponse = response.config.url?.includes('/issue-token');
          console.log(`[Pathao SDK] Response ${response.status}`, {
            url: response.config.url,
            data: isTokenResponse ? '[REDACTED]' : response.data,
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

        // Pathao's gateway allows 60 requests per rolling minute and its 429
        // carries no Retry-After, so a blind short retry always fails. Retry
        // once only when the server says how long to wait; otherwise hand the
        // 429 to the caller.
        const retryAfterSeconds = parseInt(
          (error.response?.headers?.['retry-after'] as string | undefined) ?? '',
          10,
        );
        if (
          error.response?.status === 429 &&
          error.config &&
          !error.config._rateLimitRetry &&
          retryAfterSeconds > 0
        ) {
          error.config._rateLimitRetry = true;
          await this.delay(retryAfterSeconds * 1000);
          return this.pathaoClient.request(error.config);
        }

        // Retry transient 5xx errors with exponential backoff (max 2 retries),
        // but only for requests that are safe to repeat. A 5xx on a create
        // (a gateway 502/504 in front of a slow success) may already have
        // booked the consignment; re-POSTing can book it again.
        const status: number | undefined = error.response?.status;
        if (status !== undefined && status >= 500 && error.config && isSafeToRetry(error.config)) {
          const retryCount: number = (error.config._retryCount as number | undefined) ?? 0;
          if (retryCount < 2) {
            error.config._retryCount = retryCount + 1;
            await this.delay(Math.min(500 * 2 ** retryCount, 4000));
            return this.pathaoClient.request(error.config);
          }
        }

        // Trip the circuit breaker on outages (network, 5xx) and auth failures.
        // A 429 is not an outage: counting it locked out every call for the
        // breaker timeout and re-tripped each time the rate window reset.
        const tripsBreaker = status === undefined || status >= 500 || status === 401;
        if (tripsBreaker) {
          this.handleCircuitBreaker();
        }
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
      throw new PathaoApiError(
        'Configuration validation failed: Pathao API baseURL is required. Pass it in the config, or use PathaoApiService.fromEnv() with PATHAO_BASE_URL set',
        { kind: 'config' },
      );
    }

    if (!this.config.baseURL.startsWith('https://')) {
      throw new PathaoApiError(
        'Configuration validation failed: Pathao API baseURL must use HTTPS (https://)',
        { kind: 'config' },
      );
    }

    if (
      !this.config.clientId ||
      !this.config.clientSecret ||
      !this.config.username ||
      !this.config.password
    ) {
      throw new PathaoApiError(
        'Configuration validation failed: Pathao API credentials are required: clientId, clientSecret, username, password. Pass them in the config, or use PathaoApiService.fromEnv() with PATHAO_CLIENT_ID, PATHAO_CLIENT_SECRET, PATHAO_USERNAME and PATHAO_PASSWORD set',
        { kind: 'config' },
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
          'Circuit breaker is open after repeated network, server or authentication failures. Try again later.',
          { code: 503, kind: 'unavailable' },
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
          // No response at all: timeout or network failure.
          ...(axiosLike.response ? {} : { kind: 'unavailable' as const }),
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

  // Reserves the next free slot synchronously, then waits for it, so
  // concurrent callers queue in call order.
  private async waitForRequestSlot(): Promise<void> {
    if (this.minRequestIntervalMs <= 0) return;
    const now = Date.now();
    const at = Math.max(now, this.nextRequestAt);
    this.nextRequestAt = at + this.minRequestIntervalMs;
    if (at > now) await this.delay(at - now);
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
        PathaoApiService.prepareOrder(orderData),
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

  // Official Pathao API: Get All Stores (Auto-paginating helper)
  async getStoresAll(): Promise<PathaoStore[]> {
    try {
      let currentPage = 1;
      let lastPage = 1;
      const allStores: PathaoStore[] = [];

      do {
        const response = await this.getStores(currentPage);
        if (response.data?.data) {
          allStores.push(...response.data.data);
        }
        lastPage = response.data?.last_page || 1;
        currentPage++;
      } while (currentPage <= lastPage);

      return allStores;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch all Pathao stores');
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
      const prepared = orders.map((order, i) => PathaoApiService.prepareOrder(order, `orders[${i}]: `));
      const response = await this.pathaoClient.post<PathaoBulkOrderResponse>(
        '/aladdin/api/v1/orders/bulk', { orders: prepared });
      return response.data;
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to create bulk Pathao orders');
    }
  }

  // Validates an order and returns it with phones normalised to 01XXXXXXXXX,
  // so local checks catch what Pathao would reject with a 422 and what is
  // sent is what was validated.
  private static prepareOrder(order: PathaoOrderRequest, prefix = ''): PathaoOrderRequest {
    const fail = (message: string): never => {
      throw new PathaoApiError(`Validation failed: ${prefix}${message}`, { code: 400 });
    };
    const phone = PathaoApiService.normalizePhoneNumber(order.recipient_phone ?? '');
    if (!phone) fail('Invalid recipient_phone format');
    let secondary: string | null = null;
    if (order.recipient_secondary_phone) {
      secondary = PathaoApiService.normalizePhoneNumber(order.recipient_secondary_phone);
      if (!secondary) fail('Invalid recipient_secondary_phone format');
    }
    if (!PathaoApiService.validateRecipientName(order.recipient_name ?? '')) {
      fail('Invalid recipient_name (must be 3 to 100 characters)');
    }
    if (!PathaoApiService.validateAddress(order.recipient_address ?? '')) {
      fail('Invalid recipient_address (must be 10 to 220 characters)');
    }
    if (!PathaoApiService.validateWeight(order.item_weight)) {
      fail('Invalid item_weight (must be 0.5 to 10)');
    }
    return {
      ...order,
      recipient_phone: phone as string,
      ...(secondary ? { recipient_secondary_phone: secondary } : {}),
    };
  }

  /**
   * Normalise a Bangladeshi mobile number to 01XXXXXXXXX. Accepts +8801…,
   * 8801… and 01…, with spaces, dashes, dots or parentheses. Returns null for
   * anything that isn't a BD mobile number (operator prefixes 013–019).
   */
  static normalizePhoneNumber(phone: string): string | null {
    const digits = phone.replace(/[\s\-().]/g, '').replace(/^\+/, '');
    const local = digits.startsWith('880') ? `0${digits.slice(3)}` : digits;
    return /^01[3-9]\d{8}$/.test(local) ? local : null;
  }

  // Helper method to validate phone number
  static validatePhoneNumber(phone: string): boolean {
    return PathaoApiService.normalizePhoneNumber(phone) !== null;
  }

  // Helper method to format phone number
  static formatPhoneNumber(phone: string): string {
    const normalized = PathaoApiService.normalizePhoneNumber(phone);
    if (normalized) {
      return normalized;
    }
    throw new Error(
      'Invalid phone number format. Must be a Bangladeshi mobile number (01XXXXXXXXX or +8801XXXXXXXXX)',
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
    return PathaoApiService.normalizePhoneNumber(phone) !== null;
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
  static fromEnv(options?: PathaoClientOptions): PathaoApiService {
    const config: PathaoConfig = {
      clientId: process.env.PATHAO_CLIENT_ID || '',
      clientSecret: process.env.PATHAO_CLIENT_SECRET || '',
      username: process.env.PATHAO_USERNAME || '',
      password: process.env.PATHAO_PASSWORD || '',
      baseURL: process.env.PATHAO_BASE_URL || '',
    };
    const timeout = parseInt(process.env.PATHAO_TIMEOUT || '', 10);
    if (timeout > 0) {
      config.timeout = timeout;
    }
    return new PathaoApiService(config, options);
  }

  // Static factory method to create instance from configuration object
  static fromConfig(
    config: PathaoConfig,
    options?: PathaoClientOptions,
  ): PathaoApiService {
    return new PathaoApiService(config, options);
  }

  // Named constructor for sandbox environment
  static sandbox(credentials: Omit<PathaoConfig, 'baseURL'>, options?: PathaoClientOptions): PathaoApiService {
    return new PathaoApiService(
      { ...credentials, baseURL: 'https://courier-api-sandbox.pathao.com' },
      options,
    );
  }

  // Named constructor for production environment
  static production(credentials: Omit<PathaoConfig, 'baseURL'>, options?: PathaoClientOptions): PathaoApiService {
    return new PathaoApiService(
      { ...credentials, baseURL: 'https://api-hermes.pathao.com' },
      options,
    );
  }
}

