import {
  constructEvent,
  PATHAO_SECRET_HEADER,
  PathaoWebhookError,
  PathaoWebhookEvent,
  PathaoWebhookHandler,
} from '../src/webhooks';

const SECRET = 'test-webhook-secret-abc123';

// ─── helpers ────────────────────────────────────────────────────────────────

const DELIVERED_PAYLOAD = {
  event: PathaoWebhookEvent.ORDER_DELIVERED,
  updated_at: '2024-11-20 15:11:40',
  timestamp: '2024-11-20T15:11:41Z',
  consignment_id: 'D1234567890',
  merchant_order_id: 'MY-ORD-001',
  store_id: 42,
  delivery_fee: 80,
  collected_amount: 900,
};

const HANDSHAKE_PAYLOAD = {
  event: PathaoWebhookEvent.WEBHOOK_INTEGRATION,
};

function rawBody(payload: object): string {
  return JSON.stringify(payload);
}

// ─── constructEvent ─────────────────────────────────────────────────────────

describe('constructEvent', () => {
  it('parses and returns the payload from string', () => {
    const result = constructEvent(rawBody(DELIVERED_PAYLOAD));
    expect(result.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
    expect((result as typeof DELIVERED_PAYLOAD).collected_amount).toBe(900);
  });

  it('accepts a Buffer body', () => {
    const result = constructEvent(Buffer.from(rawBody(DELIVERED_PAYLOAD)));
    expect(result.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
  });

  it('accepts an object body directly', () => {
    const result = constructEvent(DELIVERED_PAYLOAD);
    expect(result.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
  });

  it('throws PathaoWebhookError on invalid JSON string', () => {
    expect(() => constructEvent('not-json')).toThrow(PathaoWebhookError);
  });

  it('throws PathaoWebhookError when payload has no event field', () => {
    expect(() => constructEvent(JSON.stringify({ foo: 'bar' }))).toThrow(PathaoWebhookError);
  });
});

// ─── PathaoWebhookHandler ────────────────────────────────────────────────────

describe('PathaoWebhookHandler', () => {
  let handler: PathaoWebhookHandler;

  beforeEach(() => {
    handler = new PathaoWebhookHandler(SECRET);
  });

  it('throws when constructed with empty secret', () => {
    expect(() => new PathaoWebhookHandler('')).toThrow(PathaoWebhookError);
  });

  describe('process()', () => {
    it('parses and returns the payload', () => {
      const result = handler.process(rawBody(DELIVERED_PAYLOAD));
      expect(result.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
    });

    it('emits the specific event with the payload', () => {
      const listener = jest.fn();
      handler.on(PathaoWebhookEvent.ORDER_DELIVERED, listener);
      handler.process(rawBody(DELIVERED_PAYLOAD));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ event: PathaoWebhookEvent.ORDER_DELIVERED }),
      );
    });

    it('emits the catch-all "webhook" event', () => {
      const catchAll = jest.fn();
      handler.on('webhook', catchAll);
      handler.process(rawBody(DELIVERED_PAYLOAD));
      expect(catchAll).toHaveBeenCalledTimes(1);
    });

    it('emits "error" and also throws on parse error', () => {
      const onError = jest.fn();
      handler.on('error', onError);
      expect(() => handler.process('invalid-json')).toThrow(PathaoWebhookError);
      expect(onError).toHaveBeenCalledWith(expect.any(PathaoWebhookError));
    });

    it('supports once() listeners', () => {
      const listener = jest.fn();
      handler.once(PathaoWebhookEvent.ORDER_DELIVERED, listener);
      handler.process(rawBody(DELIVERED_PAYLOAD));
      handler.process(rawBody(DELIVERED_PAYLOAD));
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('expressMiddleware()', () => {
    it('handles normal event: attaches payload, sets header, and calls next', () => {
      const middleware = handler.expressMiddleware();
      const req = {
        body: Buffer.from(rawBody(DELIVERED_PAYLOAD)),
      } as Parameters<ReturnType<typeof handler.expressMiddleware>>[0];
      const send = jest.fn();
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ send }) };
      const next = jest.fn();

      middleware(req, res as never, next);

      expect(res.setHeader).toHaveBeenCalledWith(PATHAO_SECRET_HEADER, SECRET);
      expect(req.pathaoWebhook?.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
      expect(next).toHaveBeenCalledWith(); // success with no args
      expect(res.status).not.toHaveBeenCalled();
    });

    it('handles handshake event: sets header, responds 202, ignores next', () => {
      const middleware = handler.expressMiddleware();
      const req = {
        body: Buffer.from(rawBody(HANDSHAKE_PAYLOAD)),
      } as Parameters<ReturnType<typeof handler.expressMiddleware>>[0];
      const send = jest.fn();
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ send }) };
      const next = jest.fn();

      middleware(req, res as never, next);

      expect(res.setHeader).toHaveBeenCalledWith(PATHAO_SECRET_HEADER, SECRET);
      expect(req.pathaoWebhook?.event).toBe(PathaoWebhookEvent.WEBHOOK_INTEGRATION);
      expect(res.status).toHaveBeenCalledWith(202);
      expect(send).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next(err) on bad JSON but still sets the header', () => {
      const middleware = handler.expressMiddleware();
      const req = {
        body: Buffer.from('bad-data'),
      } as Parameters<ReturnType<typeof handler.expressMiddleware>>[0];
      const send = jest.fn();
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ send }) };
      const next = jest.fn();

      middleware(req, res as never, next);

      expect(res.setHeader).toHaveBeenCalledWith(PATHAO_SECRET_HEADER, SECRET);
      expect(next).toHaveBeenCalledWith(expect.any(PathaoWebhookError));
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('middleware()', () => {
    it('returns instructions for regular event', async () => {
      const handle = handler.middleware();
      const instructions = await handle(rawBody(DELIVERED_PAYLOAD));
      
      expect(instructions.error).toBeNull();
      expect(instructions.statusCode).toBe(200);
      expect(instructions.headers).toHaveProperty(PATHAO_SECRET_HEADER, SECRET);
      expect(instructions.payload?.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
    });

    it('returns instructions for handshake event (202)', async () => {
      const handle = handler.middleware();
      const instructions = await handle(rawBody(HANDSHAKE_PAYLOAD));
      
      expect(instructions.error).toBeNull();
      expect(instructions.statusCode).toBe(202);
      expect(instructions.headers).toHaveProperty(PATHAO_SECRET_HEADER, SECRET);
      expect(instructions.payload?.event).toBe(PathaoWebhookEvent.WEBHOOK_INTEGRATION);
    });

    it('returns instructions for error (400)', async () => {
      const handle = handler.middleware();
      const instructions = await handle('bad-json');
      
      expect(instructions.error).toBeInstanceOf(PathaoWebhookError);
      expect(instructions.statusCode).toBe(400);
      expect(instructions.headers).toHaveProperty(PATHAO_SECRET_HEADER, SECRET);
      expect(instructions.payload).toBeNull();
    });
  });
});
