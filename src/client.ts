// Thin, typed wrapper over the free, keyless imeilens.com REST API.
// Docs: https://imeilens.com/en/developers  ·  OpenAPI: https://imeilens.com/openapi.json

export const DEFAULT_BASE_URL = "https://imeilens.com";

export type ApiValidation = {
  imei: string;
  valid: boolean;
  reason?: "length" | "checksum" | "chars";
  type?: "imei" | "imeisv";
  tac?: string;
  reporting_body?: string;
  serial?: string;
  check_digit?: number;
  expected_check_digit?: number;
  svn?: string;
  /** Device identified from the TAC database, or null when the TAC is unknown. */
  device?: { brand: string; model: string } | null;
};

export type ApiValidateManyResult = { count: number; valid: number; results: ApiValidation[] };

export type ApiGenerateImeiOptions = {
  /** 1 to 100 (default 1). */
  count?: number;
  /** Brand key (e.g. "apple", "samsung") to use real TAC ranges of recent models. */
  brand?: string;
  /** Exact 8-digit TAC. */
  tac?: string;
  /** 0 to 14 leading digits (default "00", the test reporting body). */
  prefix?: string;
};

export type ApiGenerateImeiResult = {
  imeis: { imei: string; tac: string; model?: string }[];
  notice: string;
};

export type ApiGenerateIccidOptions = { count?: number; country?: string; length?: 19 | 20 };

export type ApiGenerateIccidResult = {
  iccids: { iccid: string; country: string; country_name: string }[];
  notice: string;
};

export type ImeiLensClientOptions = {
  /** API origin. Default "https://imeilens.com". */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to the global fetch). */
  fetch?: typeof fetch;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
};

/** Error thrown for non-2xx responses. `code` is the API's error code, e.g. "rate_limited". */
export class ImeiLensApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;
  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message);
    this.name = "ImeiLensApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/**
 * Client for the public imeilens.com API (60 requests/minute per IP, no key needed).
 * Adds what the offline helpers cannot: device brand and model lookup from the TAC database,
 * and brand-specific test IMEIs.
 */
export class ImeiLensClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(options: ImeiLensClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const f = options.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) throw new Error("No fetch implementation available. Pass one via options.fetch.");
    this.fetchImpl = f;
    this.headers = { Accept: "application/json", ...options.headers };
  }

  /** GET /api/v1/imei/validate: validate one IMEI or IMEISV and identify the device. */
  validate(imei: string): Promise<ApiValidation> {
    return this.request("GET", "/api/v1/imei/validate", { imei });
  }

  /** POST /api/v1/imei/validate: validate up to 100 IMEIs in one request. */
  validateMany(imeis: string[]): Promise<ApiValidateManyResult> {
    return this.request("POST", "/api/v1/imei/validate", undefined, { imeis });
  }

  /** GET /api/v1/imei/generate: generate test IMEIs. */
  generate(options: ApiGenerateImeiOptions = {}): Promise<ApiGenerateImeiResult> {
    return this.request("GET", "/api/v1/imei/generate", options);
  }

  /** GET /api/v1/iccid/generate: generate test ICCIDs. */
  generateIccid(options: ApiGenerateIccidOptions = {}): Promise<ApiGenerateIccidResult> {
    return this.request("GET", "/api/v1/iccid/generate", options);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    query?: Record<string, string | number | undefined>,
    body?: unknown,
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const headers = body === undefined ? this.headers : { ...this.headers, "Content-Type": "application/json" };
    const res = await this.fetchImpl(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
    if (!res.ok) {
      const retry = Number(res.headers.get("Retry-After"));
      throw new ImeiLensApiError(
        res.status,
        data?.error ?? "http_error",
        data?.message ?? `Request failed with HTTP ${res.status}`,
        Number.isFinite(retry) && retry > 0 ? retry : undefined,
      );
    }
    if (data === null) throw new ImeiLensApiError(res.status, "invalid_response", "Response was not JSON");
    return data;
  }
}
