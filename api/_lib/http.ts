import type { IncomingMessage, ServerResponse } from 'node:http';

export type ApiRequest = IncomingMessage;

export type ApiResponse = ServerResponse & {
  status(code: number): ApiResponse;
  json(body: unknown): void;
};

export function setNoStoreHeaders(response: ApiResponse): void {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
}
