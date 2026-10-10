// Identity is supplied by Sites dispatch, never by request JSON.
// Keep this boundary separate so a future Alipay adapter can supply an
// independently verified application identity without changing growth rules.
export function authenticatedUser(req: Request) {
  return req.headers.get('oai-authenticated-user-id') ||
    (process.env.NODE_ENV !== 'production' ? 'local_seedy' : null);
}
