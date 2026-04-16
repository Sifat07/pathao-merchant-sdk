import MockAdapter from "axios-mock-adapter";
import {
  DeliveryType,
  ItemType,
  PathaoApiError,
  PathaoApiService,
} from "../src/index";

describe("PathaoApiService", () => {
  let pathaoService: PathaoApiService;
  let mock: MockAdapter;
  const mockConfig = {
    baseURL: "https://api-hermes.pathao.com",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    username: "test-username",
    password: "test-password",
  };

  const authReply = {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 3600,
  };

  beforeEach(() => {
    pathaoService = new PathaoApiService(mockConfig);
    mock = new MockAdapter((pathaoService as any).pathaoClient);
    mock.onPost("/aladdin/api/v1/issue-token").reply(200, authReply);
  });

  afterEach(() => {
    mock.restore();
  });

  // ---------------------------------------------------------------------------
  // Constructor & initialization
  // ---------------------------------------------------------------------------

  describe("constructor", () => {
    it("initializes with valid config", () => {
      expect(pathaoService).toBeInstanceOf(PathaoApiService);
    });

    it("does not throw with empty credentials on initialization", () => {
      expect(
        () =>
          new PathaoApiService({
            baseURL: "",
            clientId: "",
            clientSecret: "",
            username: "",
            password: "",
          }),
      ).not.toThrow();
    });

    it("throws PathaoApiError on first API call when baseURL is missing", async () => {
      const svc = new PathaoApiService({
        baseURL: "",
        clientId: "id",
        clientSecret: "sec",
        username: "u",
        password: "p",
      });
      const innerMock = new MockAdapter((svc as any).pathaoClient);
      innerMock.onPost("/aladdin/api/v1/issue-token").reply(200, authReply);
      await expect(svc.getCities()).rejects.toBeInstanceOf(PathaoApiError);
      innerMock.restore();
    });

    it("throws PathaoApiError when baseURL is non-HTTPS", async () => {
      const svc = new PathaoApiService({
        baseURL: "http://insecure.pathao.com",
        clientId: "id",
        clientSecret: "sec",
        username: "u",
        password: "p",
      });
      const innerMock = new MockAdapter((svc as any).pathaoClient);
      innerMock.onPost("/aladdin/api/v1/issue-token").reply(200, authReply);
      await expect(svc.getCities()).rejects.toBeInstanceOf(PathaoApiError);
      innerMock.restore();
    });

    it("throws PathaoApiError on first API call when credentials are missing", async () => {
      const svc = new PathaoApiService({
        baseURL: "https://api-hermes.pathao.com",
        clientId: "",
        clientSecret: "",
        username: "",
        password: "",
      });
      const innerMock = new MockAdapter((svc as any).pathaoClient);
      innerMock.onPost("/aladdin/api/v1/issue-token").reply(200, authReply);
      await expect(svc.getCities()).rejects.toBeInstanceOf(PathaoApiError);
      innerMock.restore();
    });
  });

  // ---------------------------------------------------------------------------
  // Factory methods
  // ---------------------------------------------------------------------------

  describe("factory methods", () => {
    it("fromEnv() creates an instance", () => {
      process.env.PATHAO_CLIENT_ID = "env-id";
      process.env.PATHAO_CLIENT_SECRET = "env-secret";
      process.env.PATHAO_USERNAME = "env-user";
      process.env.PATHAO_PASSWORD = "env-pass";
      process.env.PATHAO_BASE_URL = "https://courier-api-sandbox.pathao.com";
      const svc = PathaoApiService.fromEnv();
      expect(svc).toBeInstanceOf(PathaoApiService);
      delete process.env.PATHAO_CLIENT_ID;
      delete process.env.PATHAO_CLIENT_SECRET;
      delete process.env.PATHAO_USERNAME;
      delete process.env.PATHAO_PASSWORD;
      delete process.env.PATHAO_BASE_URL;
    });

    it("fromConfig() creates an instance", () => {
      const svc = PathaoApiService.fromConfig(mockConfig);
      expect(svc).toBeInstanceOf(PathaoApiService);
    });

    it("sandbox() pre-fills sandbox baseURL", () => {
      const svc = PathaoApiService.sandbox({
        clientId: "id",
        clientSecret: "sec",
        username: "u",
        password: "p",
      });
      expect((svc as any).config.baseURL).toBe(
        "https://courier-api-sandbox.pathao.com",
      );
    });

    it("production() pre-fills production baseURL", () => {
      const svc = PathaoApiService.production({
        clientId: "id",
        clientSecret: "sec",
        username: "u",
        password: "p",
      });
      expect((svc as any).config.baseURL).toBe("https://api-hermes.pathao.com");
    });
  });

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  describe("validation helpers", () => {
    describe("validatePhoneNumber", () => {
      it("accepts valid BD mobile numbers", () => {
        expect(PathaoApiService.validatePhoneNumber("01712345678")).toBe(true);
        expect(PathaoApiService.validatePhoneNumber("01812345678")).toBe(true);
      });
      it("rejects numbers not starting with 01", () => {
        expect(PathaoApiService.validatePhoneNumber("1234567890")).toBe(false);
      });
      it("rejects numbers with wrong length", () => {
        expect(PathaoApiService.validatePhoneNumber("0171234567")).toBe(false);
      });
    });

    describe("formatPhoneNumber", () => {
      it("strips non-digits and returns formatted number", () => {
        expect(PathaoApiService.formatPhoneNumber("017-1234-5678")).toBe(
          "01712345678",
        );
        expect(PathaoApiService.formatPhoneNumber("01712345678")).toBe(
          "01712345678",
        );
      });
      it("throws for invalid numbers", () => {
        expect(() => PathaoApiService.formatPhoneNumber("1234567890")).toThrow(
          "Invalid phone number format",
        );
      });
    });

    describe("validateAddress", () => {
      it("accepts addresses within 10–220 chars", () => {
        expect(PathaoApiService.validateAddress("A".repeat(10))).toBe(true);
        expect(PathaoApiService.validateAddress("A".repeat(220))).toBe(true);
      });
      it("rejects too short or too long", () => {
        expect(PathaoApiService.validateAddress("Short")).toBe(false);
        expect(PathaoApiService.validateAddress("A".repeat(221))).toBe(false);
      });
    });

    describe("validateStoreAddress", () => {
      it("accepts store addresses within 15–120 chars", () => {
        expect(PathaoApiService.validateStoreAddress("A".repeat(15))).toBe(
          true,
        );
        expect(PathaoApiService.validateStoreAddress("A".repeat(120))).toBe(
          true,
        );
      });
      it("rejects too short or too long", () => {
        expect(PathaoApiService.validateStoreAddress("Short")).toBe(false);
        expect(PathaoApiService.validateStoreAddress("A".repeat(121))).toBe(
          false,
        );
      });
    });

    describe("validateWeight", () => {
      it("accepts 0.5–10 kg", () => {
        expect(PathaoApiService.validateWeight(0.5)).toBe(true);
        expect(PathaoApiService.validateWeight(10.0)).toBe(true);
      });
      it("rejects out-of-range weights", () => {
        expect(PathaoApiService.validateWeight(0.4)).toBe(false);
        expect(PathaoApiService.validateWeight(10.1)).toBe(false);
        expect(PathaoApiService.validateWeight(-1)).toBe(false);
      });
    });

    describe("validateRecipientName", () => {
      it("accepts names within 3–100 chars", () => {
        expect(PathaoApiService.validateRecipientName("Bob")).toBe(true);
        expect(PathaoApiService.validateRecipientName("A".repeat(100))).toBe(
          true,
        );
      });
      it("rejects too short or too long", () => {
        expect(PathaoApiService.validateRecipientName("Jo")).toBe(false);
        expect(PathaoApiService.validateRecipientName("A".repeat(101))).toBe(
          false,
        );
      });
    });

    describe("validateStoreName", () => {
      it("accepts store names within 3–50 chars", () => {
        expect(PathaoApiService.validateStoreName("My Store")).toBe(true);
        expect(PathaoApiService.validateStoreName("A".repeat(50))).toBe(true);
      });
      it("rejects too short or too long", () => {
        expect(PathaoApiService.validateStoreName("AB")).toBe(false);
        expect(PathaoApiService.validateStoreName("A".repeat(51))).toBe(false);
      });
    });

    describe("validateContactName", () => {
      it("accepts contact names within 3–50 chars", () => {
        expect(PathaoApiService.validateContactName("Ali")).toBe(true);
      });
      it("rejects too short names", () => {
        expect(PathaoApiService.validateContactName("Al")).toBe(false);
      });
    });

    describe("validateContactNumber", () => {
      it("accepts valid contact numbers", () => {
        expect(PathaoApiService.validateContactNumber("01712345678")).toBe(
          true,
        );
      });
      it("rejects numbers not starting with 01", () => {
        expect(PathaoApiService.validateContactNumber("02712345678")).toBe(
          false,
        );
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Order management
  // ---------------------------------------------------------------------------

  describe("createOrder", () => {
    const orderData = {
      store_id: 123,
      recipient_name: "John Doe",
      recipient_phone: "01712345678",
      recipient_address: "123 Main Street, Dhanmondi",
      delivery_type: DeliveryType.NORMAL,
      item_type: ItemType.PARCEL,
      item_quantity: 1,
      item_weight: 1.0,
      amount_to_collect: 500,
    };

    it("creates an order successfully", async () => {
      const mockResponse = {
        type: "success",
        code: 200,
        message: "Order created successfully",
        data: {
          consignment_id: "CONS123",
          order_status: "Pending",
          delivery_fee: 80,
        },
      };
      mock.onPost("/aladdin/api/v1/orders").reply(200, mockResponse);
      const result = await pathaoService.createOrder(orderData);
      expect(result).toEqual(mockResponse);
    });

    it("throws PathaoApiError on 400 with field errors", async () => {
      const errorResponse = {
        type: "error",
        code: 400,
        message: "Invalid order data",
        errors: { recipient_phone: ["invalid"] },
      };
      mock.onPost("/aladdin/api/v1/orders").reply(400, errorResponse);
      await expect(pathaoService.createOrder(orderData)).rejects.toBeInstanceOf(
        PathaoApiError,
      );
    });

    it("throws PathaoApiError for invalid phone number", async () => {
      await expect(
        pathaoService.createOrder({ ...orderData, recipient_phone: "12345" }),
      ).rejects.toBeInstanceOf(PathaoApiError);
    });

    it("throws PathaoApiError for invalid weight", async () => {
      await expect(
        pathaoService.createOrder({ ...orderData, item_weight: 0.1 }),
      ).rejects.toBeInstanceOf(PathaoApiError);
    });
  });

  describe("createBulkOrder", () => {
    it("creates bulk orders successfully", async () => {
      const orders = [
        {
          store_id: 123,
          recipient_name: "John",
          recipient_phone: "01712345678",
          recipient_address: "123 Main Street, Dhanmondi",
          delivery_type: DeliveryType.NORMAL,
          item_type: ItemType.PARCEL,
          item_quantity: 1,
          item_weight: 1.0,
          amount_to_collect: 500,
        },
      ];
      const mockResponse = {
        message: "Accepted",
        type: "success",
        code: 202,
        data: true,
      };
      mock.onPost("/aladdin/api/v1/orders/bulk").reply(202, mockResponse);
      const result = await pathaoService.createBulkOrder(orders);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getOrderStatus", () => {
    it("fetches order status successfully", async () => {
      const mockResponse = {
        type: "success",
        code: 200,
        message: "Order info",
        data: {
          consignment_id: "CONS123",
          order_status: "Pending",
          order_status_slug: "Pending",
          updated_at: "2024-11-20 15:11:40",
          invoice_id: null,
        },
      };
      mock
        .onGet("/aladdin/api/v1/orders/CONS123/info")
        .reply(200, mockResponse);
      const result = await pathaoService.getOrderStatus("CONS123");
      expect(result).toEqual(mockResponse);
    });

    it("URL-encodes special characters in consignment ID", async () => {
      const mockResponse = {
        type: "success",
        code: 200,
        message: "Order info",
        data: {
          consignment_id: "CONS/123",
          order_status: "Pending",
          order_status_slug: "Pending",
          updated_at: "2024-11-20 15:11:40",
          invoice_id: null,
        },
      };
      mock
        .onGet("/aladdin/api/v1/orders/CONS%2F123/info")
        .reply(200, mockResponse);
      const result = await pathaoService.getOrderStatus("CONS/123");
      expect(result).toEqual(mockResponse);
    });
  });

  // ---------------------------------------------------------------------------
  // Store management
  // ---------------------------------------------------------------------------

  describe("createStore", () => {
    it("creates a store successfully", async () => {
      const storeData = {
        name: "Test Store",
        contact_name: "Manager",
        contact_number: "01712345678",
        address: "House 10, Road 5, Dhanmondi, Dhaka",
        city_id: 1,
        zone_id: 1,
        area_id: 37,
      };
      const mockResponse = {
        type: "success",
        code: 200,
        message:
          "Store created successfully, Please wait one hour for approval.",
        data: { store_name: "Test Store" },
      };
      mock.onPost("/aladdin/api/v1/stores").reply(200, mockResponse);
      const result = await pathaoService.createStore(storeData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getStores", () => {
    const storeListResponse = {
      type: "success",
      code: 200,
      message: "Store list fetched.",
      data: {
        data: [
          {
            store_id: 1,
            store_name: "Test Store",
            store_address: "Addr",
            is_active: 1 as 0 | 1,
            city_id: 1,
            zone_id: 1,
            hub_id: 1,
            is_default_store: false,
            is_default_return_store: false,
          },
        ],
        total: 1,
        current_page: 1,
        per_page: 1000,
        total_in_page: 1,
        last_page: 1,
        path: "",
        to: 1,
        from: 1,
        last_page_url: "",
        first_page_url: "",
      },
    };

    it("fetches first page of stores", async () => {
      mock.onGet("/aladdin/api/v1/stores").reply(200, storeListResponse);
      const result = await pathaoService.getStores();
      expect(result).toEqual(storeListResponse);
    });

    it("fetches a specific page", async () => {
      mock.onGet("/aladdin/api/v1/stores").reply(200, storeListResponse);
      const result = await pathaoService.getStores(2);
      expect(result.data.data).toHaveLength(1);
    });

    it("getStoresAll() auto-paginates and returns all stores", async () => {
      mock.onGet("/aladdin/api/v1/stores").reply(200, storeListResponse);
      const result = await pathaoService.getStoresAll();
      expect(result).toHaveLength(1);
      expect(result[0].store_name).toBe("Test Store");
    });
  });

  // ---------------------------------------------------------------------------
  // Price calculation
  // ---------------------------------------------------------------------------

  describe("calculatePrice", () => {
    it("calculates price successfully", async () => {
      const priceData = {
        store_id: 123,
        item_type: ItemType.PARCEL,
        item_weight: 1.0,
        delivery_type: DeliveryType.NORMAL,
        recipient_city: 1,
        recipient_zone: 1,
      };
      const mockResponse = {
        type: "success",
        code: 200,
        message: "price",
        data: {
          price: 80,
          discount: 0,
          promo_discount: 0,
          plan_id: 69,
          cod_enabled: 1 as 0 | 1,
          cod_percentage: 0.01,
          additional_charge: 0,
          final_price: 80,
        },
      };
      mock
        .onPost("/aladdin/api/v1/merchant/price-plan")
        .reply(200, mockResponse);
      const result = await pathaoService.calculatePrice(priceData);
      expect(result).toEqual(mockResponse);
    });
  });

  // ---------------------------------------------------------------------------
  // Location services
  // ---------------------------------------------------------------------------

  describe("getCities", () => {
    it("fetches cities successfully", async () => {
      const mockResponse = {
        type: "success",
        code: 200,
        message: "City successfully fetched.",
        data: { data: [{ city_id: 1, city_name: "Dhaka" }] },
      };
      mock.onGet("/aladdin/api/v1/city-list").reply(200, mockResponse);
      const result = await pathaoService.getCities();
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getZones", () => {
    it("fetches zones for a city", async () => {
      const mockResponse = {
        type: "success",
        code: 200,
        message: "Zone list fetched.",
        data: { data: [{ zone_id: 298, zone_name: "60 feet" }] },
      };
      mock.onGet("/aladdin/api/v1/cities/1/zone-list").reply(200, mockResponse);
      const result = await pathaoService.getZones(1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("getAreas", () => {
    it("fetches areas for a zone", async () => {
      const mockResponse = {
        type: "success",
        code: 200,
        message: "Area list fetched.",
        data: {
          data: [
            {
              area_id: 37,
              area_name: "Bonolota",
              home_delivery_available: true,
              pickup_available: true,
            },
          ],
        },
      };
      mock
        .onGet("/aladdin/api/v1/zones/298/area-list")
        .reply(200, mockResponse);
      const result = await pathaoService.getAreas(298);
      expect(result).toEqual(mockResponse);
    });
  });

  // ---------------------------------------------------------------------------
  // Interceptor behavior
  // ---------------------------------------------------------------------------

  describe("interceptor behavior", () => {
    it("retries once on 401 after refreshing token", async () => {
      mock.onGet("/aladdin/api/v1/city-list").replyOnce(401);
      const mockResolvedResponse = {
        data: { data: [{ city_id: 1, city_name: "Dhaka" }] },
      };
      mock
        .onGet("/aladdin/api/v1/city-list")
        .replyOnce(200, mockResolvedResponse);
      const result = await pathaoService.getCities();
      expect(result).toEqual(mockResolvedResponse);
      expect(
        mock.history.post.some(
          (req) => req.url === "/aladdin/api/v1/issue-token",
        ),
      ).toBe(true);
    });

    it("retries once on 429 after Retry-After delay", async () => {
      mock
        .onGet("/aladdin/api/v1/city-list")
        .replyOnce(429, {}, { "retry-after": "1" });
      const mockResolvedResponse = { data: [] };
      mock
        .onGet("/aladdin/api/v1/city-list")
        .replyOnce(200, mockResolvedResponse);
      const result = await pathaoService.getCities();
      expect(result).toEqual(mockResolvedResponse);
    });

    it("retries up to 2 times on 5xx errors with backoff", async () => {
      mock.onGet("/aladdin/api/v1/city-list").replyOnce(503);
      mock.onGet("/aladdin/api/v1/city-list").replyOnce(503);
      const mockResolvedResponse = { data: { data: [] } };
      mock
        .onGet("/aladdin/api/v1/city-list")
        .replyOnce(200, mockResolvedResponse);
      const result = await pathaoService.getCities();
      expect(result).toEqual(mockResolvedResponse);
    });

    it("throws after exhausting 5xx retries", async () => {
      mock
        .onGet("/aladdin/api/v1/city-list")
        .reply(500, { message: "Server error", type: "error", code: 500 });
      await expect(pathaoService.getCities()).rejects.toBeInstanceOf(
        PathaoApiError,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Circuit breaker
  // ---------------------------------------------------------------------------

  describe("circuit breaker", () => {
    it("opens after threshold failures and throws PathaoApiError with code 503", async () => {
      const svc = new PathaoApiService(mockConfig, {
        circuitBreaker: { threshold: 2, timeout: 60000 },
      });
      const innerMock = new MockAdapter((svc as any).pathaoClient);
      // Auth fails repeatedly to trigger circuit breaker
      innerMock
        .onPost("/aladdin/api/v1/issue-token")
        .reply(500, { message: "Server error", type: "error", code: 500 });

      await expect(svc.getCities()).rejects.toBeInstanceOf(PathaoApiError);
      await expect(svc.getCities()).rejects.toBeInstanceOf(PathaoApiError);

      const err = (await svc.getCities().catch((e) => e)) as PathaoApiError;
      expect(err).toBeInstanceOf(PathaoApiError);
      expect(err.code).toBe(503);
      innerMock.restore();
    });
  });

  // ---------------------------------------------------------------------------
  // Debug mode
  // ---------------------------------------------------------------------------

  describe("debug mode", () => {
    it("logs requests and responses without exposing the Authorization token", async () => {
      const svc = new PathaoApiService(mockConfig, { debug: true });
      const innerMock = new MockAdapter((svc as any).pathaoClient);
      innerMock.onPost("/aladdin/api/v1/issue-token").reply(200, authReply);
      innerMock
        .onGet("/aladdin/api/v1/city-list")
        .reply(200, { data: { data: [] } });

      const logs: unknown[][] = [];
      jest
        .spyOn(console, "log")
        .mockImplementation((...args) => logs.push(args));

      await svc.getCities();

      const allLogText = JSON.stringify(logs);
      // Authorization header must be redacted in request logs
      expect(allLogText).toContain("[REDACTED]");
      // The raw bearer token must NOT appear in the Authorization header value
      expect(allLogText).not.toContain("Bearer mock-access-token");

      jest.restoreAllMocks();
      innerMock.restore();
    });
  });

  // ---------------------------------------------------------------------------
  // clearAuth
  // ---------------------------------------------------------------------------

  describe("clearAuth", () => {
    it("resets all authentication state", () => {
      pathaoService["accessToken"] = "test-token";
      pathaoService["refreshToken"] = "test-refresh";
      pathaoService["isAuthenticating"] = true;

      pathaoService.clearAuth();

      expect(pathaoService["accessToken"]).toBeNull();
      expect(pathaoService["refreshToken"]).toBeNull();
      expect(pathaoService["isAuthenticating"]).toBe(false);
      expect(pathaoService["authPromise"]).toBeNull();
    });
  });
});
