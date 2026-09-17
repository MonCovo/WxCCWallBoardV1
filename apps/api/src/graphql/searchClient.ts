import type { TokenManager } from "../auth/tokenManager.js";
import { config } from "../config.js";

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
      throw new Error(`Search API ${res.status}: ${text.slice(0, 300)}`);
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
