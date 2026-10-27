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

// Guard against a last_page that never ends; a merchant with more stores than
// this would have to page with getStores() themselves.
const MAX_STORE_PAGES = 100;

// GETs, token grants and the read-only price-plan POST can be repeated
// without side effects. Order and store creation cannot.
function isSafeToRetry(method: HttpMethod, path: string): boolean {
  return method === 'GET' || path.includes('/issue-token') || path.includes('/merchant/price-plan');
}

type HttpMethod = 'GET' | 'POST';

// A failed HTTP exchange: a non-2xx response, or none at all (status
// undefined: timeout or network failure). Callers turn it into a PathaoApiError.
class HttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly data?: unknown,
  ) {
    super(message);
  }
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
  /** fetch implementation to use. Default: the global fetch (Node 18+). */
  fetch?: typeof fetch;
}

export class PathaoApiService {
  private fetchImpl: typeof fetch | undefined;
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

    this.fetchImpl = options?.fetch;
  }

  // One call to Pathao, with rate spacing, auth, one re-auth on 401, one
  // Retry-After wait on 429, two backoff retries on a 5xx for requests that
  // are safe to repeat, and the circuit breaker. Every attempt, retries
  // included, waits for a rate slot.
  private async request<T>(
    method: HttpMethod,
    path: string,
    { body, params }: { body?: unknown; params?: Record<string, string | number> } = {},
  ): Promise<T> {
    const isTokenRequest = path.includes('/issue-token');
    const query = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : '';
    let reauthed = false;
    let rateLimitRetried = false;
    let serverRetries = 0;

    for (;;) {
      // Every request counts against Pathao's limit, token grants and
      // retries included, so space them all.
      await this.waitForRequestSlot();

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': `pathao-merchant-sdk node/${process.version}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      };
      // Token requests skip auth, or the grant would wait on itself.
      if (!isTokenRequest) {
        // Validate configuration on first API call
        this.validateConfiguration();
        await this.ensureAuthenticated();
        if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      if (this.debug) {
        const safeHeaders: Record<string, string> = { ...headers };
        if (safeHeaders['Authorization']) safeHeaders['Authorization'] = 'Bearer [REDACTED]';
        console.log(`[Pathao SDK] ${method} ${path}`, {
          headers: safeHeaders,
          // Field names only: order bodies carry recipient names, phones and addresses.
          fields: body && typeof body === 'object' ? Object.keys(body) : undefined,
        });
      }

      let status: number;
      let retryAfter: string | null;
      let data: unknown;
      // AbortSignal.timeout covers reading the body too: a proxy can send
      // headers and then stall.
      const signal = AbortSignal.timeout(this.config.timeout);
      try {
        const res = await (this.fetchImpl ?? fetch)(`${(this.config.baseURL ?? '').replace(/\/+$/, '')}${path}${query}`, {
          method,
          headers,
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          // Pathao has no reason to redirect, and a 307/308 would re-send the
          // issue-token body (client secret, password) to wherever it points.
          // 'manual' hands back the 3xx, which fails like any error status.
          redirect: 'manual',
          signal,
        });
        status = res.status;
        retryAfter = res.headers.get('retry-after');
        const text = await res.text();
        try {
          data = text ? JSON.parse(text) : '';
        } catch {
          data = text; // not JSON: hand back the raw text
        }
      } catch (cause) {
        // No response: timeout or network failure. An outage, so it counts
        // against the breaker; authenticate() counts token grants itself.
        if (!isTokenRequest) this.handleCircuitBreaker();
        throw new HttpError(
          signal.aborted
            ? `timeout of ${this.config.timeout}ms exceeded`
            : `request to ${path} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }

      if (status >= 200 && status < 300) {
        // Reset circuit breaker on successful request
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.isOpen = false;
        if (this.debug) {
          // Token grants carry access_token / refresh_token; never log them.
          console.log(`[Pathao SDK] Response ${status}`, { url: path, data: isTokenRequest ? '[REDACTED]' : data });
        }
        return data as T;
      }

      // A 401 on the token request itself must not take the re-auth retry:
      // ensureAuthenticated() would wait on the grant that is waiting on
      // this request, and hang forever. authenticate() counts its failures
      // against the breaker, so this path doesn't.
      if (status === 401 && !isTokenRequest) {
        // Token expired, clear tokens and retry once
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        if (!reauthed) {
          reauthed = true;
          continue;
        }
      }

      // Pathao's gateway allows 60 requests per rolling minute and its 429
      // carries no Retry-After, so a blind short retry always fails. Retry
      // once only when the server says how long to wait, up to one rate
      // window; otherwise hand the 429 to the caller.
      const retryAfterSeconds = parseInt(retryAfter ?? '', 10);
      if (status === 429 && !rateLimitRetried && retryAfterSeconds > 0 && retryAfterSeconds <= 60) {
        rateLimitRetried = true;
        await this.delay(retryAfterSeconds * 1000);
        continue;
      }

      // Retry transient 5xx errors with exponential backoff (max 2 retries),
      // but only for requests that are safe to repeat. A 5xx on a create
      // (a gateway 502/504 in front of a slow success) may already have
      // booked the consignment; re-POSTing can book it again.
      if (status >= 500 && isSafeToRetry(method, path) && serverRetries < 2) {
        await this.delay(Math.min(500 * 2 ** serverRetries, 4000));
        serverRetries++;
        continue;
      }

      // Trip the circuit breaker on outages (5xx) and auth failures.
      // A 429 is not an outage: counting it locked out every call for the
      // breaker timeout and re-tripped each time the rate window reset.
      if (!isTokenRequest && (status >= 500 || status === 401)) {
        this.handleCircuitBreaker();
      }
      throw new HttpError(`Request failed with status code ${status}`, status, data);
    }
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
      const data = await this.request<PathaoAuthResponse>('POST', '/aladdin/api/v1/issue-token', {
        body: {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          username: this.config.username,
          password: this.config.password,
          grant_type: 'password',
        },
      });

      this.storeTokens(data);
    } catch (error) {
      // The one place a failed token grant counts against the breaker.
      this.handleCircuitBreaker();
      throw this.toPathaoApiError(error, 'Authentication failed');
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const data = await this.request<PathaoAuthResponse>('POST', '/aladdin/api/v1/issue-token', {
        body: {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        },
      });

      this.storeTokens(data);
    } catch (error) {
      // Not counted: a failed refresh falls back to authenticate(), which counts.
      throw this.toPathaoApiError(error, 'Token refresh failed');
    }
  }

  private storeTokens(data: PathaoAuthResponse): void {
    if (typeof data?.access_token !== 'string' || !data.access_token) {
      throw new PathaoApiError('Pathao returned no access_token', { responseData: data });
    }
    // A missing or bad expires_in would give a NaN expiry and a fresh token
    // grant before every call; assume an hour instead.
    const seconds = Number(data.expires_in);
    const lifetimeMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 3_600_000;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || null;
    // Renew a minute early, or halfway through a very short lifetime.
    this.tokenExpiry = Date.now() + lifetimeMs - Math.min(60_000, lifetimeMs / 2);

    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
  }

  private toPathaoApiError(error: unknown, context: string): PathaoApiError {
    if (error instanceof PathaoApiError) {
      return error;
    }

    if (error instanceof HttpError) {
      const pathaoError = error.data as PathaoError | undefined;
      return new PathaoApiError(
        `${context}: ${pathaoError?.message || error.message}`,
        {
          status: error.status,
          code: pathaoError?.code ?? error.status,
          type: pathaoError?.type,
          errors: pathaoError?.errors,
          validation: pathaoError?.validation,
          responseData: pathaoError ?? error.data,
          // No response at all: timeout or network failure.
          ...(error.status === undefined ? { kind: 'unavailable' as const } : {}),
        },
      );
    }

    return new PathaoApiError(`${context}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      return await this.request<PathaoOrderResponse>('POST', '/aladdin/api/v1/orders', { body: PathaoApiService.prepareOrder(orderData) });
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to create Pathao order');
    }
  }

  // Official Pathao API: Create Store
  async createStore(
    storeData: PathaoStoreRequest,
  ): Promise<PathaoStoreCreateResponse> {
    try {
      return await this.request<PathaoStoreCreateResponse>('POST', '/aladdin/api/v1/stores', { body: storeData });
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to create Pathao store');
    }
  }

  // Official Pathao API: Get Store List
  async getStores(page?: number): Promise<PathaoStoreListResponse> {
    try {
      return await this.request<PathaoStoreListResponse>('GET', '/aladdin/api/v1/stores', page !== undefined ? { params: { page } } : {});
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
        if (currentPage > MAX_STORE_PAGES) {
          throw new PathaoApiError(
            `Store list still paging after ${MAX_STORE_PAGES} pages; refusing to keep fetching`,
          );
        }
        const response = await this.getStores(currentPage);
        const stores = response.data?.data ?? [];
        // An empty page is the end, whatever last_page claims.
        if (stores.length === 0) break;
        allStores.push(...stores);
        lastPage = Number(response.data?.last_page) || 1;
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
      return await this.request<PathaoPriceResponse>('POST', '/aladdin/api/v1/merchant/price-plan', { body: priceData });
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to calculate Pathao price');
    }
  }

  // Official Pathao API: Get Cities
  async getCities(): Promise<PathaoCityResponse> {
    try {
      return await this.request<PathaoCityResponse>('GET', '/aladdin/api/v1/city-list');
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao cities');
    }
  }

  // Official Pathao API: Get Zones for a City
  async getZones(cityId: number): Promise<PathaoZoneResponse> {
    try {
      return await this.request<PathaoZoneResponse>('GET', `/aladdin/api/v1/cities/${cityId}/zone-list`);
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao zones');
    }
  }

  // Official Pathao API: Get Areas for a Zone
  async getAreas(zoneId: number): Promise<PathaoAreaResponse> {
    try {
      return await this.request<PathaoAreaResponse>('GET', `/aladdin/api/v1/zones/${zoneId}/area-list`);
    } catch (error: unknown) {
      throw this.toPathaoApiError(error, 'Failed to fetch Pathao areas');
    }
  }

  // Official Pathao API: Get Order Status
  async getOrderStatus(
    consignmentId: string,
  ): Promise<PathaoOrderStatusResponse> {
    try {
      return await this.request<PathaoOrderStatusResponse>('GET', `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`);
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
      return await this.request<PathaoBulkOrderResponse>('POST', '/aladdin/api/v1/orders/bulk', { body: { orders: prepared } });
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

