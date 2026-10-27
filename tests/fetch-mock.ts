// Routes the SDK's fetch calls to canned replies, with the subset of the
// axios-mock-adapter API these tests used: onGet/onPost, reply/replyOnce,
// networkError, history. Unmatched requests get a 404.

export interface RecordedRequest {
  method: string;
  url: string; // path only, no origin or query
  query: string;
  data: string; // request body, "" when none
  headers: Record<string, string>;
  redirect: RequestRedirect | undefined;
}

type Reply = [status: number, body?: unknown, headers?: Record<string, string> | undefined];

interface Handler {
  method: string;
  url: string | RegExp;
  once: boolean;
  reply: (req: RecordedRequest) => Reply | 'network';
}

export class FetchMock {
  history: { get: RecordedRequest[]; post: RecordedRequest[] } = { get: [], post: [] };
  private handlers: Handler[] = [];

  /** Pass a service to route its requests here. */
  constructor(svc?: object) {
    if (svc) (svc as { fetchImpl?: typeof fetch }).fetchImpl = this.fetch;
  }

  readonly fetch: typeof fetch = async (input, init = {}) => {
    const u = new URL(String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const req: RecordedRequest = {
      method,
      url: u.pathname,
      query: u.search,
      data: (init.body as string | undefined) ?? '',
      headers,
      redirect: init.redirect,
    };
    (method === 'POST' ? this.history.post : this.history.get).push(req);

    const i = this.handlers.findIndex(
      (h) => h.method === method && (typeof h.url === 'string' ? h.url === req.url : h.url.test(req.url)),
    );
    if (i < 0) return new Response(null, { status: 404 });
    const handler = this.handlers[i]!;
    if (handler.once) this.handlers.splice(i, 1);

    const reply = handler.reply(req);
    if (reply === 'network') throw new TypeError('fetch failed');
    const [status, body, replyHeaders] = reply;
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: replyHeaders ?? {} });
  };

  onGet(url: string | RegExp) {
    return this.on('GET', url);
  }

  onPost(url: string | RegExp) {
    return this.on('POST', url);
  }

  restore(): void {
    this.handlers = [];
  }

  private on(method: string, url: string | RegExp) {
    const add = (once: boolean, reply: Handler['reply']): FetchMock => {
      const handler = { method, url, once, reply };
      // Like axios-mock-adapter: a lasting reply replaces the lasting reply
      // for the same route; one-off replies queue in order.
      const j = once
        ? -1
        : this.handlers.findIndex((h) => !h.once && h.method === method && String(h.url) === String(url));
      if (j >= 0) this.handlers[j] = handler;
      else this.handlers.push(handler);
      return this;
    };
    return {
      reply: (status: number | ((req: RecordedRequest) => Reply), body?: unknown, headers?: Record<string, string>) =>
        add(false, typeof status === 'function' ? status : () => [status, body, headers]),
      replyOnce: (status: number, body?: unknown, headers?: Record<string, string>) =>
        add(true, () => [status, body, headers]),
      networkError: () => add(false, () => 'network'),
    };
  }
}
