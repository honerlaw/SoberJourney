import { EventSource as WebEventSource } from "eventsource";

type Options = EventSourceInit & {
  headers?: Record<string, string> | null;
};

export class CustomEventSource extends WebEventSource {
  constructor(url: string, options: EventSourceInit) {
    const opts = options as Options;
    super(url, {
      ...options,
      fetch: (input, init) => {
        return fetch(input, {
          ...init,
          headers: {
            ...init.headers,
            ...(opts.headers || {}),
          },
        });
      },
    });
  }
}
