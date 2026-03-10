import {
  constructEvent,
  PATHAO_SIGNATURE_HEADER,
  PathaoWebhookError,
  PathaoWebhookEvent,
  PathaoWebhookHandler,
  verifySignature,
} from '../src/webhooks';

const SECRET = 'test-webhook-secret-abc123';
const WRONG_SECRET = 'wrong-secret';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeHeaders(signature?: string): Record<string, string> {
  return signature !== undefined ? { [PATHAO_SIGNATURE_HEADER]: signature } : {};
}

const DELIVERED_PAYLOAD = {
  event: PathaoWebhookEvent.ORDER_DELIVERED,
  updated_at: '2024-11-20T15:11:40Z',
  timestamp: '2024-11-20T15:11:41Z',
  consignment_id: 'D1234567890',
  merchant_order_id: 'MY-ORD-001',
  store_id: 42,
  delivery_fee: 80,
  collected_amount: 900,
};

const STORE_CREATED_PAYLOAD = {
  event: PathaoWebhookEvent.STORE_CREATED,
  updated_at: '2024-11-20T10:00:00Z',
  timestamp: '2024-11-20T10:00:01Z',
  store_id: 42,
  store_name: 'Demo Store',
  store_address: 'House 123, Road 4, Dhaka',
  is_active: 1 as const,
};

function rawBody(payload: object): string {
  return JSON.stringify(payload);
}

// ─── verifySignature ────────────────────────────────────────────────────────

describe('verifySignature', () => {
  it('returns true when signature matches the secret', () => {
    expect(verifySignature(SECRET, SECRET)).toBe(true);
  });

  it('returns false when signature does not match', () => {
    expect(verifySignature(WRONG_SECRET, SECRET)).toBe(false);
  });

  it('returns false when signature is undefined', () => {
    expect(verifySignature(undefined, SECRET)).toBe(false);
  });

  it('returns false when signature is empty string', () => {
    expect(verifySignature('', SECRET)).toBe(false);
  });

  it('returns false when lengths differ (timing-safe)', () => {
    expect(verifySignature('short', SECRET)).toBe(false);
  });
});

// ─── constructEvent ─────────────────────────────────────────────────────────

describe('constructEvent', () => {
  it('parses and returns the payload when signature is valid', () => {
    const result = constructEvent(
      rawBody(DELIVERED_PAYLOAD),
      makeHeaders(SECRET),
      SECRET,
    );
    expect(result.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
    expect((result as typeof DELIVERED_PAYLOAD).collected_amount).toBe(900);
  });

  it('accepts a Buffer body', () => {
    const result = constructEvent(
      Buffer.from(rawBody(DELIVERED_PAYLOAD)),
      makeHeaders(SECRET),
      SECRET,
    );
    expect(result.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
  });

  it('accepts the signature header in any case', () => {
    const result = constructEvent(
      rawBody(DELIVERED_PAYLOAD),
      { 'X-PATHAO-Signature': SECRET },
      SECRET,
    );
    expect(result.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
  });

  it('throws PathaoWebhookError when signature header is missing', () => {
    expect(() =>
      constructEvent(rawBody(DELIVERED_PAYLOAD), {}, SECRET),
    ).toThrow(PathaoWebhookError);
  });

  it('throws PathaoWebhookError when signature is wrong', () => {
    expect(() =>
      constructEvent(rawBody(DELIVERED_PAYLOAD), makeHeaders(WRONG_SECRET), SECRET),
    ).toThrow(PathaoWebhookError);
  });

  it('throws PathaoWebhookError on invalid JSON body', () => {
    expect(() =>
      constructEvent('not-json', makeHeaders(SECRET), SECRET),
    ).toThrow(PathaoWebhookError);
  });

  it('throws PathaoWebhookError when payload has no event field', () => {
    expect(() =>
      constructEvent(JSON.stringify({ foo: 'bar' }), makeHeaders(SECRET), SECRET),
    ).toThrow(PathaoWebhookError);
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
    it('verifies, parses, and returns the payload', () => {
      const result = handler.process(rawBody(DELIVERED_PAYLOAD), makeHeaders(SECRET));
      expect(result.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
    });

    it('emits the specific event with the payload', () => {
      const listener = jest.fn();
      handler.on(PathaoWebhookEvent.ORDER_DELIVERED, listener);
      handler.process(rawBody(DELIVERED_PAYLOAD), makeHeaders(SECRET));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ event: PathaoWebhookEvent.ORDER_DELIVERED }),
      );
    });

    it('emits the catch-all "webhook" event', () => {
      const catchAll = jest.fn();
      handler.on('webhook', catchAll);
      handler.process(rawBody(DELIVERED_PAYLOAD), makeHeaders(SECRET));
      expect(catchAll).toHaveBeenCalledTimes(1);
    });

    it('emits "error" and also throws on bad signature', () => {
      const onError = jest.fn();
      handler.on('error', onError);
      expect(() =>
        handler.process(rawBody(DELIVERED_PAYLOAD), makeHeaders(WRONG_SECRET)),
      ).toThrow(PathaoWebhookError);
      expect(onError).toHaveBeenCalledWith(expect.any(PathaoWebhookError));
    });

    it('dispatches store.created to store listeners', () => {
      const storeListener = jest.fn();
      handler.on(PathaoWebhookEvent.STORE_CREATED, storeListener);
      handler.process(rawBody(STORE_CREATED_PAYLOAD), makeHeaders(SECRET));
      expect(storeListener).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: 42, store_name: 'Demo Store' }),
      );
    });
  });

  describe('expressMiddleware()', () => {
    it('attaches parsed payload to req.pathaoWebhook and calls next()', () => {
      const middleware = handler.expressMiddleware();
      const req = {
        body: Buffer.from(rawBody(DELIVERED_PAYLOAD)),
        headers: makeHeaders(SECRET),
      } as Parameters<ReturnType<typeof handler.expressMiddleware>>[0];
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res as never, next);

      expect(next).toHaveBeenCalledWith(/* no error */);
      expect(req.pathaoWebhook?.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 400 and does NOT call next on bad signature', () => {
      const middleware = handler.expressMiddleware();
      const req = {
        body: Buffer.from(rawBody(DELIVERED_PAYLOAD)),
        headers: makeHeaders(WRONG_SECRET),
      } as Parameters<ReturnType<typeof handler.expressMiddleware>>[0];
      const json = jest.fn();
      const res = { status: jest.fn().mockReturnValue({ json }), json };
      const next = jest.fn();

      middleware(req, res as never, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('middleware()', () => {
    it('resolves with payload on success', async () => {
      const handle = handler.middleware();
      const { payload, error } = await handle(
        rawBody(DELIVERED_PAYLOAD),
        makeHeaders(SECRET),
      );
      expect(error).toBeNull();
      expect(payload?.event).toBe(PathaoWebhookEvent.ORDER_DELIVERED);
    });

    it('resolves with error on bad signature (does not reject)', async () => {
      const handle = handler.middleware();
      const { payload, error } = await handle(
        rawBody(DELIVERED_PAYLOAD),
        makeHeaders(WRONG_SECRET),
      );
      expect(payload).toBeNull();
      expect(error).toBeInstanceOf(PathaoWebhookError);
    });
  });
});
