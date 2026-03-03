import { httpLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/backend/trpc/app-router";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  const url = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  return url || '';
};

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: getBaseUrl() ? `${getBaseUrl()}/api/trpc` : '/api/trpc',
      transformer: superjson,
      headers() {
        const headers: Record<string, string> = {};
        if (authToken) {
          headers["authorization"] = `Bearer ${authToken}`;
        }
        return headers;
      },
    }),
  ],
});
