type Fetch = typeof fetch;

/**
 * `fetch` that gives up. On a weak connection a request can hang for a minute or more, which looks like a spinner that
 * never ends. After `ms` the request is aborted and fails like any other network error ("Network request timed out"),
 * which the screens already treat as "check your connection". Uploads get longer, since a photo takes a while.
 */
export function withTimeout(base: Fetch, ms = 15_000, uploadMs = 60_000): Fetch {
  return (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const limit = url.includes('/storage/v1/object') ? uploadMs : ms;

    const controller = new AbortController();
    const caller = init?.signal;
    if (caller) {
      if (caller.aborted) controller.abort();
      else caller.addEventListener('abort', () => controller.abort());
    }
    const timer = setTimeout(() => controller.abort(), limit);

    return base(input, { ...init, signal: controller.signal })
      .catch((error) => {
        // Only our own timer turns an abort into a timeout; a caller who cancelled keeps their error.
        if (controller.signal.aborted && !caller?.aborted) throw new TypeError('Network request timed out');
        throw error;
      })
      .finally(() => clearTimeout(timer));
  };
}
