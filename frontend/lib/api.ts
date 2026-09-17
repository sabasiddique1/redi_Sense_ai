import type {
  ApiResult,
  CopilotChatPayload,
  CopilotChatResponse,
  CopilotConversationResponse,
  CopilotConversationSummary,
  DashboardSummaryResponse,
  EvidenceSearchResponse,
  PatientListItem,
  PatientProfileResponse,
  PublicConfigResponse,
  ReportAnalysisPayload,
  ReportAnalysisResponse,
  ReportUploadResponse,
  TimelineEventResponse,
  TriageAnalyzePayload,
  TriageAnalyzeResponse,
} from "./contracts";

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export const apiBaseUrl = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
);

const DEFAULT_TIMEOUT_MS = 20_000;
const EVIDENCE_SEARCH_TIMEOUT_MS = parsePositiveInt(
  process.env.NEXT_PUBLIC_EVIDENCE_SEARCH_TIMEOUT_MS,
  15_000,
);
/**
 * Reads a localStorage value by its current key, falling back once to a legacy
 * key. When only the legacy key holds a value it is copied to the new key and
 * the legacy entry is removed, so the migration runs a single time per browser.
 */
export function readStorageWithLegacyFallback(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  key: string,
  legacyKey: string,
): string | null {
  const current = storage.getItem(key);
  if (current !== null) {
    return current;
  }

  const legacy = storage.getItem(legacyKey);
  if (legacy === null) {
    return null;
  }

  try {
    storage.setItem(key, legacy);
    storage.removeItem(legacyKey);
  } catch {
    // Storage may be full or read-only; still return the legacy value.
  }
  return legacy;
}

const AUTH_TOKEN_STORAGE_KEY = "redisense-auth-token";
const LEGACY_AUTH_TOKEN_STORAGE_KEY = "reportiq-auth-token";

type FallbackOptions<T> = {
  demoMode?: boolean;
  fallback?: () => T;
  fallbackMessage?: string;
};

type UploadOptions<T> = FallbackOptions<T> & {
  patientId?: number | null;
  onProgress?: (progress: number) => void;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

export class ApiError extends Error {
  status?: number;
  requestId?: string;
  detail?: string;

  constructor(message: string, options?: { status?: number; requestId?: string; detail?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status;
    this.requestId = options?.requestId;
    this.detail = options?.detail;
  }
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return readStorageWithLegacyFallback(
    window.localStorage,
    AUTH_TOKEN_STORAGE_KEY,
    LEGACY_AUTH_TOKEN_STORAGE_KEY,
  );
}

function buildHeaders(initial?: HeadersInit): Headers {
  const headers = new Headers(initial);
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

function parseJsonPayload(raw: string): Record<string, unknown> {
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new ApiError("Unexpected response from the API.");
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  const parsed = parseJsonPayload(raw);

  if (!response.ok) {
    throw new ApiError(
      String(parsed.detail ?? `Request failed with status ${response.status}`),
      {
        status: response.status,
        requestId: typeof parsed.request_id === "string" ? parsed.request_id : undefined,
        detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
      },
    );
  }

  return parsed as T;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: buildHeaders(init.headers),
      signal: controller.signal,
    });
    return await parseJsonResponse<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request timed out.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.detail ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unable to reach the API.";
}

function extractResultMode<T>(data: T): ApiResult<T>["mode"] {
  if (
    typeof data === "object" &&
    data !== null &&
    "mode" in data &&
    typeof (data as { mode?: unknown }).mode === "string"
  ) {
    const mode = (data as { mode: string }).mode;
    if (mode === "real" || mode === "fallback" || mode === "demo" || mode === "error") {
      return mode;
    }
  }
  return "real";
}

export async function withDemoFallback<T>(
  operation: () => Promise<T>,
  options: FallbackOptions<T> = {},
): Promise<ApiResult<T>> {
  const { demoMode = false, fallback, fallbackMessage } = options;

  if (demoMode && fallback) {
    const data = fallback();
    return {
      data,
      source: "demo",
      mode: "demo",
      warning: fallbackMessage,
    };
  }

  try {
    const data = await operation();
    return {
      data,
      source: "api",
      mode: extractResultMode(data),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(formatError(error));
  }
}

function uploadMultipart<T>(
  path: string,
  file: File,
  options: {
    patientId?: number | null;
    onProgress?: (progress: number) => void;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBaseUrl}${path}`);
    xhr.timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options.onProgress) {
        return;
      }
      options.onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror = () => reject(new ApiError("Upload failed."));
    xhr.ontimeout = () => reject(new ApiError("Upload timed out."));
    xhr.onload = () => {
      let parsed: Record<string, unknown> = {};
      try {
        if (xhr.responseText) {
          parsed = parseJsonPayload(xhr.responseText);
        }
      } catch (error) {
        reject(error);
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as T);
        return;
      }

      reject(
        new ApiError(
          String(parsed.detail ?? `Request failed with status ${xhr.status}`),
          {
            status: xhr.status,
            requestId: typeof parsed.request_id === "string" ? parsed.request_id : undefined,
            detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
          },
        ),
      );
    };

    const formData = new FormData();
    if (options.patientId != null) {
      formData.append("patient_id", String(options.patientId));
    }
    formData.append("file", file);
    xhr.send(formData);
  });
}

export const apiClient = {
  fetchPublicConfig(): Promise<PublicConfigResponse> {
    return requestJson<PublicConfigResponse>("/api/system/config");
  },

  fetchDashboardSummary(options?: FallbackOptions<DashboardSummaryResponse>) {
    return withDemoFallback(
      () => requestJson<DashboardSummaryResponse>("/api/dashboard/summary"),
      options,
    );
  },

  fetchPatients(options?: FallbackOptions<PatientListItem[]>) {
    return withDemoFallback(
      () => requestJson<PatientListItem[]>("/api/patient"),
      options,
    );
  },

  fetchPatient(patientId: number, options?: FallbackOptions<PatientProfileResponse>) {
    return withDemoFallback(
      () => requestJson<PatientProfileResponse>(`/api/patient/${patientId}`),
      options,
    );
  },

  fetchTimeline(patientId: number, options?: FallbackOptions<TimelineEventResponse[]>) {
    return withDemoFallback(
      () => requestJson<TimelineEventResponse[]>(`/api/patient/${patientId}/timeline`),
      options,
    );
  },

  analyzeReportText(payload: ReportAnalysisPayload, options?: FallbackOptions<ReportAnalysisResponse>) {
    return withDemoFallback(
      () =>
        requestJson<ReportAnalysisResponse>("/api/report/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      options,
    );
  },

  uploadReport(file: File, options?: UploadOptions<ReportUploadResponse>) {
    return withDemoFallback(
      () =>
        uploadMultipart<ReportUploadResponse>("/api/report/upload", file, {
          patientId: options?.patientId,
          onProgress: options?.onProgress,
        }),
      options,
    );
  },

  analyzeTriage(
    payload: TriageAnalyzePayload,
    options?: FallbackOptions<TriageAnalyzeResponse>,
  ) {
    return withDemoFallback(
      () =>
        requestJson<TriageAnalyzeResponse>("/api/triage/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      options,
    );
  },

  searchEvidence(
    query: string,
    options?: FallbackOptions<EvidenceSearchResponse>,
  ) {
    return withDemoFallback(
      () =>
        requestJson<EvidenceSearchResponse>(
          `/api/evidence/search?query=${encodeURIComponent(query)}`,
          {},
          EVIDENCE_SEARCH_TIMEOUT_MS,
        ),
      options,
    );
  },

  copilotChat(
    payload: CopilotChatPayload,
    options?: FallbackOptions<CopilotChatResponse>,
  ) {
    return withDemoFallback(
      () =>
        requestJson<CopilotChatResponse>("/api/copilot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      options,
    );
  },

  fetchCopilotConversations(
    patientId?: number | null,
    options?: FallbackOptions<CopilotConversationSummary[]>,
  ) {
    const params = new URLSearchParams();
    if (patientId != null) {
      params.set("patient_id", String(patientId));
    }
    params.set("limit", "8");

    return withDemoFallback(
      () =>
        requestJson<CopilotConversationSummary[]>(
          `/api/copilot/conversations?${params.toString()}`,
        ),
      options,
    );
  },

  fetchCopilotConversation(
    conversationId: number,
    options?: FallbackOptions<CopilotConversationResponse>,
  ) {
    return withDemoFallback(
      () =>
        requestJson<CopilotConversationResponse>(
          `/api/copilot/conversations/${conversationId}`,
        ),
      options,
    );
  },
};
