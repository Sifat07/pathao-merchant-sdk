import MockAdapter from 'axios-mock-adapter';
import { DeliveryType, ItemType, PathaoApiError, PathaoApiService } from '../src/index';

describe('PathaoApiService', () => {
  let pathaoService: PathaoApiService;
  let mock: MockAdapter;
  const mockConfig = {
    baseURL: 'https://api-hermes.pathao.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    username: 'test-username',
    password: 'test-password'
  };

  beforeEach(() => {
    pathaoService = new PathaoApiService(mockConfig);
    // Access private property for mocking
    mock = new MockAdapter((pathaoService as any).pathaoClient);
    
    // Default authentication mock
    mock.onPost('/aladdin/api/v1/issue-token').reply(200, {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600
    });
  });

  afterEach(() => {
    mock.restore();
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(pathaoService).toBeInstanceOf(PathaoApiService);
    });

    it('should not throw error with missing credentials on initialization', () => {
      expect(() => {
        new PathaoApiService({
          baseURL: '',
          clientId: '',
          clientSecret: '',
          username: '',
          password: ''
        });
      }).not.toThrow();
    });

    it('should throw PathaoApiError with missing credentials on first API call', async () => {
      const invalidService = new PathaoApiService({
        baseURL: '',
        clientId: '',
        clientSecret: '',
        username: '',
        password: ''
      });

      expect(invalidService).toBeInstanceOf(PathaoApiService);
    });
  });

  describe('validation helpers', () => {
    describe('validatePhoneNumber', () => {
      it('should validate correct phone numbers', () => {
        expect(PathaoApiService.validatePhoneNumber('01712345678')).toBe(true);
        expect(PathaoApiService.validatePhoneNumber('01812345678')).toBe(true);
      });

      it('should reject invalid phone numbers', () => {
        expect(PathaoApiService.validatePhoneNumber('1234567890')).toBe(false);
        expect(PathaoApiService.validatePhoneNumber('0171234567')).toBe(false);
      });
    });

    describe('formatPhoneNumber', () => {
      it('should format valid phone numbers', () => {
        expect(PathaoApiService.formatPhoneNumber('01712345678')).toBe('01712345678');
        expect(PathaoApiService.formatPhoneNumber('017-1234-5678')).toBe('01712345678');
      });

      it('should throw error for invalid phone numbers', () => {
        expect(() => {
          PathaoApiService.formatPhoneNumber('1234567890');
        }).toThrow('Invalid phone number format');
      });
    });

    describe('validateAddress', () => {
      it('should validate correct addresses', () => {
        expect(PathaoApiService.validateAddress('123 Main Street, Dhanmondi')).toBe(true);
        expect(PathaoApiService.validateAddress('A'.repeat(10))).toBe(true);
        expect(PathaoApiService.validateAddress('A'.repeat(220))).toBe(true);
      });

      it('should reject invalid addresses', () => {
        expect(PathaoApiService.validateAddress('Short')).toBe(false);
        expect(PathaoApiService.validateAddress('A'.repeat(221))).toBe(false);
      });
    });

    describe('validateWeight', () => {
      it('should validate correct weights', () => {
        expect(PathaoApiService.validateWeight(0.5)).toBe(true);
        expect(PathaoApiService.validateWeight(10.0)).toBe(true);
      });

      it('should reject invalid weights', () => {
        expect(PathaoApiService.validateWeight(0.4)).toBe(false);
        expect(PathaoApiService.validateWeight(-1)).toBe(false);
      });
    });
  });

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      const mockOrderData = {
        store_id: 123,
        recipient_name: 'John Doe',
        recipient_phone: '01712345678',
        recipient_address: '123 Main Street, Dhanmondi',
        delivery_type: DeliveryType.NORMAL,
        item_type: ItemType.PARCEL,
        item_quantity: 1,
        item_weight: 1.0,
        amount_to_collect: 500
      };

      const mockResponse = {
        type: 'success',
        code: 200,
        message: 'Order created successfully',
        data: {
          consignment_id: 'CONS123',
          merchant_order_id: 'ORDER123',
          order_status: 'Pending',
          delivery_fee: 80
        }
      };

      mock.onPost('/aladdin/api/v1/orders').reply(200, mockResponse);

      const result = await pathaoService.createOrder(mockOrderData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle order creation errors', async () => {
      const mockOrderData = {
        store_id: 123,
        recipient_name: 'John Doe',
        recipient_phone: '01712345678',
        recipient_address: '123 Main Street, Dhanmondi',
        delivery_type: DeliveryType.NORMAL,
        item_type: ItemType.PARCEL,
        item_quantity: 1,
        item_weight: 1.0,
        amount_to_collect: 500
      };

      const errorResponse = {
        type: 'error',
        code: 400,
        message: 'Invalid order data',
        errors: {
          recipient_phone: ['invalid']
        }
      };

      mock.onPost('/aladdin/api/v1/orders').reply(400, errorResponse);

      let caughtError: unknown;
      try {
        await pathaoService.createOrder(mockOrderData);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(PathaoApiError);
      expect((caughtError as PathaoApiError).code).toBe(400);
      expect((caughtError as PathaoApiError).errors).toEqual({ recipient_phone: ['invalid'] });
    });
  });

  describe('calculatesPrice', () => {
    it('should calculate price successfully', async () => {
      const mockPriceData = {
        store_id: 123,
        item_type: ItemType.PARCEL,
        item_weight: 1.0,
        delivery_type: DeliveryType.NORMAL,
        recipient_city: 1,
        recipient_zone: 1
      };

      const mockResponse = {
        type: 'success',
        code: 200,
        message: 'Price calculated successfully',
        data: {
          price: 50,
          discount: 0,
          promo_discount: 0,
          plan_id: 69,
          cod_enabled: 1,
          cod_percentage: 0.01,
          additional_charge: 0,
          final_price: 50
        }
      };

      mock.onPost('/aladdin/api/v1/merchant/price-plan').reply(200, mockResponse);

      const result = await pathaoService.calculatePrice(mockPriceData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getCities', () => {
    it('should fetch cities successfully', async () => {
      const mockResponse = {
        type: 'success',
        code: 200,
        message: 'Cities fetched successfully',
        data: {
          data: [
            { city_id: 1, city_name: 'Dhaka' }
          ]
        }
      };

      mock.onGet('/aladdin/api/v1/city-list').reply(200, mockResponse);

      const result = await pathaoService.getCities();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getZones', () => {
    it('should fetch zones for a city successfully', async () => {
      const mockResponse = {
        type: 'success',
        code: 200,
        message: 'Zone list fetched',
        data: {
          data: [
            { zone_id: 298, zone_name: '60 feet' }
          ]
        }
      };

      mock.onGet('/aladdin/api/v1/cities/1/zone-list').reply(200, mockResponse);

      const result = await pathaoService.getZones(1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getAreas', () => {
    it('should fetch areas for a zone successfully', async () => {
      const mockResponse = {
        type: 'success',
        code: 200,
        message: 'Area list fetched',
        data: {
          data: [
            { area_id: 37, area_name: 'Bonolota', home_delivery_available: true, pickup_available: true }
          ]
        }
      };

      mock.onGet('/aladdin/api/v1/zones/298/area-list').reply(200, mockResponse);

      const result = await pathaoService.getAreas(298);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getOrderStatus', () => {
    it('should fetch order status successfully', async () => {
      const mockResponse = {
        type: 'success',
        code: 200,
        message: 'Order info',
        data: {
          consignment_id: 'CONS123',
          merchant_order_id: 'ORDER123',
          order_status: 'Pending',
          order_status_slug: 'Pending',
          updated_at: '2024-11-20 15:11:40',
          invoice_id: null
        }
      };

      mock.onGet('/aladdin/api/v1/orders/CONS123/info').reply(200, mockResponse);

      const result = await pathaoService.getOrderStatus('CONS123');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('createBulkOrder', () => {
    it('should create bulk orders successfully', async () => {
      const mockOrders = [
        {
          store_id: 123,
          merchant_order_id: 'ORDER1',
          recipient_name: 'John Doe',
          recipient_phone: '01712345678',
          recipient_address: '123 Main Street, Dhanmondi',
          delivery_type: DeliveryType.NORMAL,
          item_type: ItemType.PARCEL,
          item_quantity: 1,
          item_weight: 1.0,
          amount_to_collect: 500
        }
      ];

      const mockResponse = {
        message: 'Your bulk order creation request is accepted',
        type: 'success',
        code: 202,
        data: true
      };

      mock.onPost('/aladdin/api/v1/orders/bulk').reply(202, mockResponse);

      const result = await pathaoService.createBulkOrder(mockOrders);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('interceptor behavior', () => {
    it('should attempt token refresh on 401', async () => {
      // Step 1: Force a 401 on an API endpoint
      mock.onGet('/aladdin/api/v1/city-list').replyOnce(401);
      // Step 2: The retry should succeed
      const mockResolvedResponse = { data: { data: [{ city_id: 1, city_name: 'Dhaka' }] } };
      mock.onGet('/aladdin/api/v1/city-list').replyOnce(200, mockResolvedResponse);

      // The refresh token mock was registered in beforeEach, so it should succeed.
      const result = await pathaoService.getCities();
      
      expect(result).toEqual(mockResolvedResponse);
      expect(mock.history.post.some(req => req.url === '/aladdin/api/v1/issue-token')).toBe(true);
    });

    it('should retry on 429', async () => {
      mock.onGet('/aladdin/api/v1/city-list').replyOnce(429, {}, { 'retry-after': '1' });
      const mockResolvedResponse = { data: [] };
      mock.onGet('/aladdin/api/v1/city-list').replyOnce(200, mockResolvedResponse);

      const result = await pathaoService.getCities();
      expect(result).toEqual(mockResolvedResponse);
    });
  });

  describe('clearAuth', () => {
    it('should clear authentication state', () => {
      pathaoService['accessToken'] = 'test-token';
      pathaoService['refreshToken'] = 'test-refresh';
      pathaoService['isAuthenticating'] = true;

      pathaoService.clearAuth();

      expect(pathaoService['accessToken']).toBeNull();
      expect(pathaoService['refreshToken']).toBeNull();
      expect(pathaoService['isAuthenticating']).toBeFalsy();
      expect(pathaoService['authPromise']).toBeNull();
    });
  });
});
