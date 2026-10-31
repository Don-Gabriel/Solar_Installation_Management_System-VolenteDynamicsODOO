import { QueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useRef } from "react";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
let csrfToken = "";
export function setCsrf(value: string) {
  csrfToken = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: { path: string; message: string }[],
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(!isForm && options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.method && options.method !== "GET"
        ? { "X-CSRF-Token": csrfToken }
        : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== "/login" && path !== "/me") {
      queryClient.setQueryData(["session"], null);
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== "session",
      });
    }
    throw new ApiError(
      data?.error?.message ||
        "Unable to connect. Check your connection and retry.",
      response.status,
      data?.error?.fields,
    );
  }
  return data;
}
export function useData<T = any>(path: string, enabled = true) {
  return useQuery<T>({
    queryKey: [path],
    enabled,
    queryFn: () => api<T>(path),
  });
}
export function useCommand(path: string, onSuccess?: (data: any) => void) {
  const attempt = useRef<{ key: string; body: string } | null>(null);
  return useMutation({
    mutationFn: (body: any = {}) => {
      const payload = JSON.stringify(body);
      if (!attempt.current || attempt.current.body !== payload)
        attempt.current = { key: crypto.randomUUID(), body: payload };
      return api(path, {
        method: "POST",
        body: payload,
        headers: { "Idempotency-Key": attempt.current.key },
      });
    },
    onSuccess: async (data) => {
      attempt.current = null;
      await queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== "session",
      });
      onSuccess?.(data);
    },
  });
}
export const money = (minor: number | string = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number(minor) % 100 ? 2 : 0,
  }).format(Number(minor) / 100);
export const date = (value: string | undefined | null, time = false) =>
  value
    ? new Intl.DateTimeFormat("en-IN", {
        timeZone:"Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "Not scheduled";
export const human = (value: string = "") =>
  value.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase());
export const projectNumber = (n: number) => `SP-${String(n).padStart(4, "0")}`;
