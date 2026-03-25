import axios, { AxiosInstance, AxiosError } from "axios";

interface TokenCache {
  token: string;
  expiresAt: number;
}

export class ZohoClient {
  private httpClient: AxiosInstance;
  private tokenCache: TokenCache | null = null;
  private readonly baseUrl: string;
  private readonly accountsUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;

  constructor() {
    this.baseUrl = process.env.ZOHO_BASE_URL || "https://www.zohoapis.com/crm/v7";
    this.accountsUrl = process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com";
    this.clientId = process.env.ZOHO_CLIENT_ID || "";
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET || "";
    this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || "";

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error("Missing required env vars: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN");
    }

    this.httpClient = axios.create({ baseURL: this.baseUrl });
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 60000) {
      return this.tokenCache.token;
    }

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
    });

    const response = await axios.post(
      `${this.accountsUrl}/oauth/v2/token`,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, expires_in } = response.data;
    this.tokenCache = {
      token: access_token,
      expiresAt: now + (expires_in || 3600) * 1000,
    };

    return access_token;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const token = await this.getAccessToken();
    try {
      const response = await this.httpClient.get<T>(path, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params,
      });
      return response.data;
    } catch (err) {
      throw this.formatError(err);
    }
  }

  async post<T>(path: string, data?: unknown, params?: Record<string, unknown>): Promise<T> {
    const token = await this.getAccessToken();
    try {
      const response = await this.httpClient.post<T>(path, data, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params,
      });
      return response.data;
    } catch (err) {
      throw this.formatError(err);
    }
  }

  async put<T>(path: string, data?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    try {
      const response = await this.httpClient.put<T>(path, data, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      });
      return response.data;
    } catch (err) {
      throw this.formatError(err);
    }
  }

  async delete<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const token = await this.getAccessToken();
    try {
      const response = await this.httpClient.delete<T>(path, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params,
      });
      return response.data;
    } catch (err) {
      throw this.formatError(err);
    }
  }

  private formatError(err: unknown): Error {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError<{ code?: string; message?: string; details?: unknown }>;
      const status = axiosErr.response?.status;
      const body = axiosErr.response?.data;
      const code = body?.code || "UNKNOWN";
      const message = body?.message || axiosErr.message;
      const details = body?.details ? ` Details: ${JSON.stringify(body.details)}` : "";
      return new Error(`ZOHO API Error [${status}] ${code}: ${message}${details}`);
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
