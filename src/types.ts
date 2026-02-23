// Zoho CRM API Types

export interface ZohoConfig {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  apiDomain: string; // e.g., https://www.zohoapis.com
  accountsDomain: string; // e.g., https://accounts.zoho.com
}

export interface ZohoApiResponse {
  data?: unknown[];
  info?: {
    per_page?: number;
    count?: number;
    page?: number;
    more_records?: boolean;
    page_token_expiry?: string;
    next_page_token?: string;
    previous_page_token?: string;
  };
  status?: string;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ZohoRecord {
  id: string;
  [key: string]: unknown;
}

export interface ZohoModule {
  api_name: string;
  module_name: string;
  singular_label: string;
  plural_label: string;
  id: string;
  [key: string]: unknown;
}

export interface ZohoField {
  api_name: string;
  field_label: string;
  data_type: string;
  id: string;
  required: boolean;
  [key: string]: unknown;
}

export interface ZohoUser {
  id: string;
  name: string;
  email: string;
  role: { name: string; id: string };
  profile: { name: string; id: string };
  [key: string]: unknown;
}

export interface ZohoNote {
  id: string;
  Note_Title: string;
  Note_Content: string;
  Parent_Id: { id: string; name: string };
  [key: string]: unknown;
}

export interface ZohoTag {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface ZohoBulkJob {
  id: string;
  operation: string;
  state: string;
  [key: string]: unknown;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
  refresh_token?: string;
  error?: string;
}
