const API_URL = process.env.SPOK_API_URL ?? 'http://localhost:3001';
const EMAIL = process.env.SPOK_EMAIL ?? '';
const PASSWORD = process.env.SPOK_PASSWORD ?? '';

let token = '';

async function login() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('SPOK_EMAIL et SPOK_PASSWORD sont requis dans les variables d\'env.');
  }
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SPOK login échoué (${res.status}): ${body}`);
  }
  const data = await res.json() as any;
  token = data.tokens.accessToken;
}

async function req(path: string, options: RequestInit = {}, retry = true): Promise<any> {
  if (!token) await login();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  // Token expiré → re-login une fois
  if (res.status === 401 && retry) {
    await login();
    return req(path, options, false);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`SPOK API ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<any>;
}

export const api = {
  get: (path: string) => req(path),
  post: (path: string, body: unknown) => req(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) => req(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
