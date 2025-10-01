import { PathaoApiService, DeliveryType, ItemType } from '../src/index';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('PathaoApiService', () => {
  let pathaoService: PathaoApiService;
  const mockConfig = {
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
            invoice_id: 'INV123',
            merchant_order_id: 'ORDER123',
            store_id: 123,
            recipient_name: 'John Doe',
            recipient_phone: '01712345678',
            recipient_address: '123 Main Street, Dhanmondi',
            recipient_city: 'Dhaka',
            recipient_zone: 'Dhanmondi',
            recipient_area: 'Dhanmondi 27',
            delivery_type: 'Normal',
            item_type: 'Parcel',
            item_quantity: 1,
            item_weight: 1.0,
            item_description: '',
            amount_to_collect: 500,
            special_instruction: '',
            status: 'Pending',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
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
          data: {
            type: 'error',
            code: 400,
            message: 'Invalid order data'
          }
        }
      };

      mockedAxios.create().post.mockRejectedValue(mockError);

      await expect(pathaoService.createOrder(mockOrderData)).rejects.toThrow('Failed to create Pathao order');
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
        recipient_zone: 1,
        recipient_area: 1
      };

      const mockResponse = {
        data: {
          type: 'success',
          code: 200,
          message: 'Price calculated successfully',
          data: {
            store_id: 123,
            item_type: 'Parcel',
            item_weight: 1.0,
            delivery_type: 'Normal',
            recipient_city: 'Dhaka',
            recipient_zone: 'Dhanmondi',
            recipient_area: 'Dhanmondi 27',
            delivery_charge: 50,
            cod_charge: 10,
            total_charge: 60,
            currency: 'BDT'
          }
        }
      };

      mockedAxios.create().post.mockResolvedValue(mockResponse);

      const result = await pathaoService.calculatePrice(mockPriceData);

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.create().post).toHaveBeenCalledWith('/aladdin/api/v1/merchant/price-check', mockPriceData);
    });
  });

  describe('getCities', () => {
    it('should fetch cities successfully', async () => {
      const mockResponse = {
        data: {
          type: 'success',
          code: 200,
          message: 'Cities fetched successfully',
          data: [
            {
              city_id: 1,
              city_name: 'Dhaka',
              zone_list: [
                {
                  zone_id: 1,
                  zone_name: 'Dhanmondi',
                  area_list: [
                    {
                      area_id: 1,
                      area_name: 'Dhanmondi 27'
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      mockedAxios.create().get.mockResolvedValue(mockResponse);

      const result = await pathaoService.getCities();

      expect(result).toEqual(mockResponse.data);
      expect(mockedAxios.create().get).toHaveBeenCalledWith('/aladdin/api/v1/cities');
    });
  });
});
