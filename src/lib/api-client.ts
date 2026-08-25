export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiError {
  ok: false;
  status: number;
  error: string;
}
export type ApiResult<T> = ApiSuccess<T> | ApiError;

export async function apiCall<T>(
  url: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    const isFormData = init?.body instanceof FormData;
    res = await fetch(url, {
      credentials: "same-origin",
      ...init,
      headers: isFormData
        ? (init?.headers ?? {})
        : {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
          },
    });
  } catch {
    return { ok: false, status: 0, error: "Network request failed" };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const error =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed with status ${res.status}`;
    return { ok: false, status: res.status, error };
  }
  return { ok: true, data: body as T };
}
