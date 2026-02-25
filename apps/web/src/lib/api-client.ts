/**
 * API Helper để call Backend với JWT authentication
 * Sử dụng NextAuth session token làm JWT Bearer token
 */

const API_BASE_URL = "/api";

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const response = await fetch("/api/auth/token");
  if (!response.ok) {
    throw new Error("Failed to get authentication token");
  }
  const data = await response.json();
  cachedToken = data.token;
  return cachedToken!;
}

export function clearTokenCache() {
  cachedToken = null;
}

/** Returns the cached JWT token synchronously (null if not yet fetched). */
export function getCachedToken(): string | null {
  return cachedToken;
}

interface ApiOptions extends Omit<RequestInit, "method" | "headers" | "body"> {
  token?: string;
}

async function request<T = unknown>(
  endpoint: string,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any,
  options: ApiOptions = {},
): Promise<T> {
  const token = options.token || (await getToken());

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
  };

  if (body && method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T = unknown>(endpoint: string, options?: ApiOptions) =>
    request<T>(endpoint, "GET", undefined, options),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: <T = unknown>(endpoint: string, body?: any, options?: ApiOptions) =>
    request<T>(endpoint, "POST", body, options),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: <T = unknown>(endpoint: string, body?: any, options?: ApiOptions) =>
    request<T>(endpoint, "PATCH", body, options),

  delete: <T = unknown>(endpoint: string, options?: ApiOptions) =>
    request<T>(endpoint, "DELETE", undefined, options),
};

export async function getClientToken(): Promise<string> {
  return getToken();
}
