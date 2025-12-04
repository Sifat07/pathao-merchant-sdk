import { PathaoApiService, DeliveryType, ItemType, PathaoApiError } from '../src/index';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('PathaoApiService', () => {
  let pathaoService: PathaoApiService;
  const mockConfig = {
    baseURL: 'https://api-hermes.pathao.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    username: 'test-username',
    password: 'test-password'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue({
      post: jest.fn(),
      get: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn()
        },
        response: {
          use: jest.fn()
        }
      }
    });
    pathaoService = new PathaoApiService(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(pathaoService).toBeInstanceOf(PathaoApiService);
    });

    it('should throw error with missing credentials', () => {
      expect(() => {
        new PathaoApiService({
          baseURL: 'https://api-hermes.pathao.com',
          clientId: '',
          clientSecret: 'test',
          username: 'test',
          password: 'test'
        });
      }).toThrow('Pathao API credentials are required');
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
        expect(PathaoApiService.validatePhoneNumber('017123456789')).toBe(false);
        expect(PathaoApiService.validatePhoneNumber('02712345678')).toBe(false);
      });
    });

    describe('formatPhoneNumber', () => {
      it('should format valid phone numbers', () => {
        expect(PathaoApiService.formatPhoneNumber('01712345678')).toBe('01712345678');
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
        expect(PathaoApiService.validateAddress('A'.repeat(9))).toBe(false);
        expect(PathaoApiService.validateAddress('A'.repeat(221))).toBe(false);
        expect(PathaoApiService.validateAddress('')).toBe(false);
      });
    });

    describe('validateWeight', () => {
      it('should validate correct weights', () => {
        expect(PathaoApiService.validateWeight(0.5)).toBe(true);
        expect(PathaoApiService.validateWeight(5.0)).toBe(true);
        expect(PathaoApiService.validateWeight(10.0)).toBe(true);
      });

      it('should reject invalid weights', () => {
        expect(PathaoApiService.validateWeight(0.4)).toBe(false);
        expect(PathaoApiService.validateWeight(10.1)).toBe(false);
        expect(PathaoApiService.validateWeight(-1)).toBe(false);
      });
    });

    describe('validateRecipientName', () => {
      it('should validate correct names', () => {
        expect(PathaoApiService.validateRecipientName('John Doe')).toBe(true);
        expect(PathaoApiService.validateRecipientName('A'.repeat(3))).toBe(true);
        expect(PathaoApiService.validateRecipientName('A'.repeat(100))).toBe(true);
      });

      it('should reject invalid names', () => {
        expect(PathaoApiService.validateRecipientName('Jo')).toBe(false);
        expect(PathaoApiService.validateRecipientName('A'.repeat(2))).toBe(false);
        expect(PathaoApiService.validateRecipientName('A'.repeat(101))).toBe(false);
        expect(PathaoApiService.validateRecipientName('')).toBe(false);
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
        data: {
          type: 'success',
          code: 200,
          message: 'Order created successfully',
          data: {
            consignment_id: 'CONS123',
            merchant_order_id: 'ORDER123',
            order_status: 'Pending',
            delivery_fee: 80
          }
        }
      };

      mockedAxios.create().post.mockResolvedValue(mockResponse);

      const result = await pathaoService.createOrder(mockOrderData);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.create().post).toHaveBeenCalledWith('/aladdin/api/v1/orders', mockOrderData);
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

      const mockError = {
        response: {
          status: 400,
          data: {
            type: 'error',
            code: 400,
            message: 'Invalid order data',
            errors: {
              recipient_phone: ['invalid']
            }
          }
        }
      };

      mockedAxios.create().post.mockRejectedValue(mockError);

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

  describe('calculatePrice', () => {
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
        data: {
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
        }
      };

      mockedAxios.create().post.mockResolvedValue(mockResponse);

      const result = await pathaoService.calculatePrice(mockPriceData);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.create().post).toHaveBeenCalledWith('/aladdin/api/v1/merchant/price-plan', mockPriceData);
    });
  });

  describe('getCities', () => {
    it('should fetch cities successfully', async () => {
      const mockResponse = {
        data: {
          type: 'success',
          code: 200,
          message: 'Cities fetched successfully',
          data: {
            data: [
              {
                city_id: 1,
                city_name: 'Dhaka'
              },
              {
                city_id: 2,
                city_name: 'Chittagong'
              }
            ]
          }
        }
      };

      mockedAxios.create().get.mockResolvedValue(mockResponse);

      const result = await pathaoService.getCities();

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/aladdin/api/v1/city-list');
    });
  });

  describe('getZones', () => {
    it('should fetch zones for a city successfully', async () => {
      const mockResponse = {
        data: {
          type: 'success',
          code: 200,
          message: 'Zone list fetched',
          data: {
            data: [
              {
                zone_id: 298,
                zone_name: '60 feet'
              },
              {
                zone_id: 1070,
                zone_name: 'Abdullahpur Uttara'
              }
            ]
          }
        }
      };

      mockedAxios.create().get.mockResolvedValue(mockResponse);

      const result = await pathaoService.getZones(1);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/aladdin/api/v1/cities/1/zone-list');
    });
  });

  describe('getAreas', () => {
    it('should fetch areas for a zone successfully', async () => {
      const mockResponse = {
        data: {
          type: 'success',
          code: 200,
          message: 'Area list fetched',
          data: {
            data: [
              {
                area_id: 37,
                area_name: 'Bonolota',
                home_delivery_available: true,
                pickup_available: true
              },
              {
                area_id: 3,
                area_name: 'Road 03',
                home_delivery_available: true,
                pickup_available: true
              }
            ]
          }
        }
      };

      mockedAxios.create().get.mockResolvedValue(mockResponse);

      const result = await pathaoService.getAreas(298);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/aladdin/api/v1/zones/298/area-list');
    });
  });

  describe('getOrderStatus', () => {
    it('should fetch order status successfully', async () => {
      const mockResponse = {
        data: {
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
        }
      };

      mockedAxios.create().get.mockResolvedValue(mockResponse);

      const result = await pathaoService.getOrderStatus('CONS123');

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/aladdin/api/v1/orders/CONS123/info');
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
        data: {
          message: 'Your bulk order creation request is accepted,<br>  please wait some time to complete order creation.',
          type: 'success',
          code: 202,
          data: true
        }
      };

      mockedAxios.create().post.mockResolvedValue(mockResponse);

      const result = await pathaoService.createBulkOrder(mockOrders);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.create().post).toHaveBeenCalledWith('/aladdin/api/v1/orders/bulk', { orders: mockOrders });
    });
  });

  describe('clearAuth', () => {
    it('should clear authentication state', () => {
      // Set some auth state
      pathaoService['accessToken'] = 'test-token';
      pathaoService['refreshToken'] = 'test-refresh';
      pathaoService['isAuthenticating'] = true;

      pathaoService.clearAuth();

      expect(pathaoService['accessToken']).toBeNull();
      expect(pathaoService['refreshToken']).toBeNull();
      expect(pathaoService['isAuthenticating']).toBeFalsy();
      expect(pathaoService['authPromise']).toBeNull();
      expect(pathaoService['requestQueue']).toEqual([]);
    });
  });
});
