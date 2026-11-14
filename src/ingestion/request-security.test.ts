import { describe, expect, it } from 'vitest';
import { assertSameOrigin } from '../../api/_lib/request-security.js';
import type { ApiRequest } from '../../api/_lib/http.js';

function request(headers: Record<string, string>): ApiRequest {
  return { headers } as unknown as ApiRequest;
}

describe('same-origin mutation protection', () => {
  it('accepts a same-origin HTTPS browser request', () => {
    expect(() => assertSameOrigin(request({
      host: 'example.vercel.app',
      origin: 'https://example.vercel.app',
    }))).not.toThrow();
  });

  it('rejects a cross-origin request', () => {
    expect(() => assertSameOrigin(request({
      host: 'example.vercel.app',
      origin: 'https://attacker.example',
    }))).toThrow();
  });

  it('rejects requests without an Origin header', () => {
    expect(() => assertSameOrigin(request({
      host: 'example.vercel.app',
    }))).toThrow();
  });
});
