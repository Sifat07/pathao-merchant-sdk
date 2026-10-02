import {
  isFinalLifecycleStatus,
  PathaoApiError,
  PathaoApiService,
  toLifecycleStatus,
} from '../src/index';
import MockAdapter from 'axios-mock-adapter';

describe('toLifecycleStatus', () => {
  it('maps webhook events and slug spellings to the same status', () => {
    for (const v of ['order.pickup-requested', 'Pickup Requested', 'pickup_requested', 'pickup-requested']) {
      expect(toLifecycleStatus(v)).toBe('created');
    }
    expect(toLifecycleStatus('Pending')).toBe('created');
    expect(toLifecycleStatus('order.delivered')).toBe('delivered');
    expect(toLifecycleStatus('order.assigned-for-delivery')).toBe('out_for_delivery');
  });

  // The parcel isn't back yet when the return ID is created.
  it('treats return-id-created as returning, returned-to-merchant as returned', () => {
    expect(toLifecycleStatus('order.return-id-created')).toBe('returning');
    expect(toLifecycleStatus('order.returned-to-merchant')).toBe('returned');
  });

  it('returns unknown for non-lifecycle events and unseen values', () => {
    expect(toLifecycleStatus('order.updated')).toBe('unknown');
    expect(toLifecycleStatus('store.created')).toBe('unknown');
    expect(toLifecycleStatus('something-new')).toBe('unknown');
  });

  it('flags final statuses', () => {
    expect(isFinalLifecycleStatus('delivered')).toBe(true);
    expect(isFinalLifecycleStatus('returned')).toBe(true);
    expect(isFinalLifecycleStatus('returning')).toBe(false);
    expect(isFinalLifecycleStatus('unknown')).toBe(false);
  });
});

describe('PathaoApiError kind', () => {
  const config = {
    baseURL: 'https://api-hermes.pathao.com',
    clientId: 'id',
    clientSecret: 'sec',
    username: 'u',
    password: 'p',
  };

  async function errorFor(reply: (m: MockAdapter) => void, svc = new PathaoApiService(config)) {
    const mock = new MockAdapter((svc as any).pathaoClient);
    mock.onPost('/aladdin/api/v1/issue-token').reply(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600 });
    reply(mock);
    const err = (await svc.getOrderStatus('C1').catch((e) => e)) as PathaoApiError;
    mock.restore();
    return err;
  }

  it.each([
    [422, 'validation', false],
    [404, 'not_found', false],
    [429, 'rate_limited', true],
    [403, 'forbidden', false],
  ])('HTTP %i -> %s (retryable %s)', async (status, kind, retryable) => {
    const err = await errorFor((m) => m.onGet(/info/).reply(status, {}));
    expect(err.kind).toBe(kind);
    expect(err.retryable).toBe(retryable);
  });

  it('network failure -> unavailable, retryable', async () => {
    const err = await errorFor((m) => m.onGet(/info/).networkError());
    expect(err.kind).toBe('unavailable');
    expect(err.retryable).toBe(true);
  });

  it('missing credentials -> config', async () => {
    const err = await errorFor(() => {}, new PathaoApiService({ ...config, password: '' }));
    expect(err.kind).toBe('config');
    expect(err.retryable).toBe(false);
  });

  it('local validation -> validation', async () => {
    const svc = new PathaoApiService(config);
    const err = (await svc
      .createOrder({ recipient_phone: '1' } as any)
      .catch((e) => e)) as PathaoApiError;
    expect(err.kind).toBe('validation');
  });
});
