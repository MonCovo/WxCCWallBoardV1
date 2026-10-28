import type { TokenManager } from "../auth/tokenManager.js";
import { config } from "../config.js";

function summarizeSearchError(text: string): string {
  try {
    const json = JSON.parse(text) as {
      error?: { message?: Array<{ description?: string }> };
      errors?: Array<{ message?: string }>;
    };
    const descriptions = json.error?.message
      ?.map((m) => m.description)
      .filter(Boolean);
    if (descriptions?.length) return descriptions.join("; ");
    const gql = json.errors?.map((e) => e.message).filter(Boolean);
    if (gql?.length) return gql.join("; ");
  } catch {
    // fall through to raw text
  }
  return text.slice(0, 500);
}

export class SearchClient {
  constructor(private readonly tokens: TokenManager) {}

  async query<T = unknown>(graphql: string): Promise<T> {
    const run = async (token: string) => {
      const res = await fetch(`${config.webex.apiBase}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: graphql }),
      });
      return res;
    };

    let token = await this.tokens.getAccessToken();
    let res = await run(token);

    if (res.status === 401) {
      token = await this.tokens.refresh();
      res = await run(token);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Search API ${res.status}: ${summarizeSearchError(text)}`);
    }

    const json = (await res.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    if (!json.data) {
      throw new Error("Search API returned no data");
    }
    return json.data;
  }
}
