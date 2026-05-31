const RICKY_TOOLS = [
  "mcp", "agent", "tool-use", "llm", "vercel", "automation",
  "rag", "embedding", "claude", "openai", "perplexity",
  "workflow", "chatbot", "ai-agent", "langchain", "langgraph",
  "crewai", "autogen", "manus", "function-calling", "prompt"
];

const AI_KEYWORDS = [
  "llm", "agent", "mcp", "rag", "embedding", "fine-tune",
  "inference", "transformer", "diffusion", "multimodal",
  "claude", "gpt", "gemini", "mistral", "llama", "qwen",
  "openai", "anthropic", "huggingface", "langchain",
  "tool-use", "function-calling", "prompt", "ai", "copilot"
];

async function fetchGitHubTrending(period) {
  const url = `https://github.com/trending?since=${period}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 github-trend-mcp/1.0" }
  });
  const html = await res.text();

  const repos = [];
  const repoPattern = /<article class="Box-row">([\s\S]*?)<\/article>/g;
  let match;

  while ((match = repoPattern.exec(html)) !== null) {
    const block = match[1];

    const nameMatch = block.match(/href="\/([\w\-]+\/[\w\-\.]+)"/);
    const fullName = nameMatch ? nameMatch[1] : null;
    if (!fullName) continue;

    const descMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const description = descMatch
      ? descMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    const starsMatch = block.match(/([\d,]+)\s*stars? today/);
    const starsToday = starsMatch ? starsMatch[1].replace(/,/g, "") : "0";

    const totalMatch = block.match(/aria-label="star"[\s\S]{0,200}?([\d,]+)/);
    const stars = totalMatch ? totalMatch[1].replace(/,/g, "") : "0";

    repos.push({ fullName, description, stars, starsToday });
  }

  return repos;
}

function isAIRelated(repo) {
  const text = `${repo.fullName} ${repo.description}`.toLowerCase();
  return AI_KEYWORDS.some(kw => text.includes(kw));
}

function getRickyTags(repo) {
  const text = `${repo.fullName} ${repo.description}`.toLowerCase();
  return RICKY_TOOLS.filter(kw => text.includes(kw));
}

async function analyzeTrends(period) {
  const all = await fetchGitHubTrending(period);
  const aiRepos = all.filter(isAIRelated).slice(0, 20);

  const related = [];
  const newTrend = [];

  for (const repo of aiRepos) {
    const tags = getRickyTags(repo);
    if (tags.length > 0) {
      related.push({ ...repo, rickyTags: tags });
    } else {
      newTrend.push(repo);
    }
  }

  return { related, newTrend, total: aiRepos.length, period };
}

function formatResult(data) {
  const lines = [];
  lines.push(`📊 GitHub AI 트렌드 [${data.period}] — AI 관련 ${data.total}개\n`);

  if (data.related.length > 0) {
    lines.push("🔗 Ricky 도구와 연관");
    for (const r of data.related) {
      lines.push(`• ${r.fullName} (+${r.starsToday} today)`);
      if (r.description) lines.push(`  ${r.description}`);
      lines.push(`  [${r.rickyTags.join(", ")}]`);
    }
    lines.push("");
  }

  if (data.newTrend.length > 0) {
    lines.push("🚀 신규 트렌드");
    for (const r of data.newTrend.slice(0, 8)) {
      lines.push(`• ${r.fullName} (+${r.starsToday} today)`);
      if (r.description) lines.push(`  ${r.description}`);
    }
  }

  if (data.total === 0) {
    lines.push("⚠️ AI 관련 repo를 찾지 못했습니다. GitHub Trending 페이지 구조가 변경되었을 수 있습니다.");
  }

  return lines.join("\n");
}

async function handleMCP(body) {
  const { method, params, id } = body;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "github-trend-mcp", version: "1.0.0" }
      }
    };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0", id,
      result: {
        tools: [{
          name: "github_trending_ai",
          description: "GitHub에서 AI/에이전트/MCP 관련 트렌딩 repo를 수집하고 Ricky 기존 도구와의 연관성을 분류합니다.",
          inputSchema: {
            type: "object",
            properties: {
              period: {
                type: "string",
                enum: ["daily", "weekly", "monthly"],
                description: "수집 기간 (기본: weekly)"
              }
            }
          }
        }]
      }
    };
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (toolName === "github_trending_ai") {
      try {
        const period = args.period || "weekly";
        const data = await analyzeTrends(period);
        const text = formatResult(data);
        return {
          jsonrpc: "2.0", id,
          result: { content: [{ type: "text", text }] }
        };
      } catch (err) {
        return {
          jsonrpc: "2.0", id,
          result: { content: [{ type: "text", text: `오류: ${err.message}` }] }
        };
      }
    }
  }

  return {
    jsonrpc: "2.0", id,
    result: {}
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const serverInfo = {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {
        serverInfo: { name: "github-trend-mcp", version: "1.0.0" },
        capabilities: { tools: {} }
      }
    };
    res.write(`data: ${JSON.stringify(serverInfo)}\n\n`);
    req.on("close", () => res.end());
    return;
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const result = await handleMCP(body);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: "Not found" });
}
