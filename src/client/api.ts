import posthog from "posthog-js";

if (import.meta.env.VITE_POSTHOG_KEY)
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: "memory",
  });

/** Never send model contents, filenames, brick labels, or session identifiers. */
export function track(
  event: string,
  properties: Record<string, string | number | boolean> = {},
) {
  if (import.meta.env.VITE_POSTHOG_KEY)
    posthog.capture(`brickmedic_${event}`, {
      ...properties,
      page: window.location.pathname,
    });
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Something went wrong. Please try again.");
  return result;
}
