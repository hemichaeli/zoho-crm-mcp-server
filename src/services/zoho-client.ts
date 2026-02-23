import type { ZohoConfig, TokenResponse } from "../types.js";

const CHARACTER_LIMIT = 100000;

let config: ZohoConfig = {
  accessToken: process.env.ZOHO_ACCESS_TOKEN || "",
  refreshToken: process.env.ZOHO_REFRESH_TOKEN || "",
  clientId: process.env.ZOHO_CLIENT_ID || "",
  clientSecret: process.env.ZOHO_CLIENT_SECRET || "",
  apiDomain: process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com",
  accountsDomain: process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com",
};

export function getConfig(): ZohoConfig {
  return config;
}

export function updateConfig(updates: Partial<ZohoConfig>): void {
  config = { ...config, ...updates };
}

export async function refreshAccessToken(): Promise<string> {
  if (!config.refreshToken || !config.clientId || !config.clientSecret) {
    throw new Error(
      "Missing refresh token, client ID, or client secret. " +
      "Set ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, and ZOHO_CLIENT_SECRET environment variables."
    );
  }

  const params = new URLSearchParams({
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(`${config.accountsDomain}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = (await response.json()) as TokenResponse;

  if (data.error) {
    throw new Error(`Token refresh failed: ${data.error}`);
  }

  config.accessToken = data.access_token;
  if (data.api_domain) {
    config.apiDomain = data.api_domain;
  }

  return data.access_token;
}

export async function zohoRequest(
  path: string,
  method: string = "GET",
  body?: unknown,
  queryParams?: Record<string, string>,
  retried: boolean = false
): Promise<unknown> {
  if (!config.accessToken) {
    await refreshAccessToken();
  }

  let url = `${config.apiDomain}/crm/v7/${path}`;
  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${config.accessToken}`,
  };

  const fetchOptions: RequestInit = { method, headers };

  if (body) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  // Handle token expiry - auto refresh
  if (response.status === 401 && !retried) {
    await refreshAccessToken();
    return zohoRequest(path, method, body, queryParams, true);
  }

  if (response.status === 204) {
    return { status: "success", message: "No content" };
  }

  const responseText = await response.text();

  if (!response.ok) {
    let errorDetail: string;
    try {
      const errorJson = JSON.parse(responseText);
      errorDetail = JSON.stringify(errorJson, null, 2);
    } catch {
      errorDetail = responseText;
    }
    throw new Error(
      `Zoho API error (${response.status}): ${errorDetail}`
    );
  }

  if (!responseText) {
    return { status: "success" };
  }

  const data = JSON.parse(responseText);
  return data;
}

export function truncateResponse(text: string): string {
  if (text.length > CHARACTER_LIMIT) {
    return (
      text.substring(0, CHARACTER_LIMIT) +
      "\n\n[Response truncated. Use pagination or filters to narrow results.]"
    );
  }
  return text;
}

export function formatResponse(data: unknown): string {
  const text = JSON.stringify(data, null, 2);
  return truncateResponse(text);
}

export function buildToolResponse(data: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text" as const, text: formatResponse(data) }],
  };
}

export function buildErrorResponse(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
} {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
