// Thin client for the Tavily web-search API. Used by Learn Mode to pull
// authoritative source material for a topic before an LLM turns it into a
// grounded lesson chapter. Not an LLM call, so it lives outside lib/llm.ts.

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export interface TavilySearchResponse {
  answer: string | null;
  results: TavilyResult[];
}

export async function tavilySearch(
  query: string,
  opts: { maxResults?: number; depth?: "basic" | "advanced" } = {},
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY is not set");

  const res = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: opts.depth ?? "advanced",
      max_results: opts.maxResults ?? 6,
      include_answer: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed (${res.status})`);
  }

  const data = (await res.json()) as {
    answer?: string;
    results?: { title?: string; url?: string; content?: string }[];
  };

  return {
    answer: data.answer ?? null,
    results: (data.results ?? [])
      .filter((r): r is { title: string; url: string; content: string } =>
        Boolean(r.url && r.content),
      )
      .map((r) => ({ title: r.title || r.url, url: r.url, content: r.content })),
  };
}
