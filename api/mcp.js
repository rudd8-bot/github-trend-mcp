// github-trend-mcp: AI 생태계 트렌드 수집 MCP 서버
// Ricky 기존 도구 태그 자동 분류 포함

const RICKY_TOOLS = [
  "mcp", "agent", "tool-use", "llm", "vercel", "n8n",
  "rag", "embedding", "claude", "openai", "perplexity",
  "automation", "workflow", "chatbot", "ai-agent",
  "langchain", "langgraph", "crew", "autogen", "manus"
];

const AI_KEYWORDS = [
  "llm", "agent", "mcp", "rag", "embedding", "fine-tune",
  "inference", "transformer", "diffusion", "multimodal",
  "claude", "gpt", "gemini", "mistral", "llama", "qwen",
  "openai", "anthropic", "huggingface", "langchain",
  "tool-use", "function-calling", "prompt", "ai"
];

// GitHub Trending 스크래핑 (공식 API 없음 → trending 페이지 파싱)
async function fetchGitHubTrending(period = "weekly") {
  const url = `https://github.com/trending?since=${period}&spoken_language_code=`;
  const res = await fetch(url, {
    headers: { "User-Agent": "github-trend-mcp/1.0" }
  });
  const html = await res.text();

  // repo 블록 파싱
  const repos = [];
  const repoPattern = /<article class="Box-row">([\s\S]*?)<\/article>/g;
  let match;

  while ((match = repoPattern.exec(html)) !== null) {
    const block = match[1];

    // repo 이름
    const nameMatch = block.match(/href="\/([^"]+)"\s*>\s*[\s\S]*?<\/a>/);
    const fullName = nameMatch ? nameMatch[1].trim().replace(/\s+/g, "") : null;
    if (!fullName || fullName.split("/").length !== 2) continue;

    // description
    const descMatch = block.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    const description = descMatch
      ? descMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // stars
    const starsMatch = block.match(/aria-label="star"[\s\S]*?([\d,]+)\s*<\/a>/);
    const stars = starsMatch ? starsMatch[1].replace(/,/g, "") : "0";

    // language
    const langMatch = block.match(/itemprop="programmingLanguage"[^>]*>(.*?)<\/span>/);
    const language = langMatch ? langMatch[1].trim() : "";

    // stars today
    const todayMatch = block.match(/([\d,]+)\s*stars? today/);
    const starsToday = todayMatch ? todayMatch[1].replace(/,/g, "") : "0";

    repos.push({ fullName, description, stars, starsToday, language });
  }

  return repos;
}

// AI 관련 여부 필터
function isAIRelated(repo) {
  const text = `${repo.fullName} ${repo.description}`.toLowerCase();
  return AI_KEYWORDS.some(kw => text.includes(kw));
}

// Ricky 도구 관련 태그
function getRickyTags(repo) {
  const text = `${repo.fullName} ${repo.description}`.toLowerCase();
  return RICKY_TOOLS.filter(kw => text.includes(kw));
}

// 트렌드 분석 + 분류
async function analyzeTrends(period = "weekly") {
  const all = await fetchGitHubTrending(period);
  const aiRepos = all.filter(isAIRelated).slice(0, 20);

  const related = [];    // Ricky 도구와 겹치는 것
  const newTrend = [];   // 신규 트렌드

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

// 결과 포맷팅
function formatResult(data) {
  const lines = [];
  lines.push(`📊 GitHub AI 트렌드 (${data.period} / 총 ${data.total}개)\n`);

  if (data.related.length > 0) {
    lines.push("🔗 **Ricky 도구와 연관된 것**");
    for (const r of data.related) {
      lines.push(`• ${r.fullName} ⭐${r.stars} (+${r.starsToday}/day)`);
      if (r.description) lines.push(`  ${r.description}`);
      lines.push(`  태그: ${r.rickyTags.join(", ")}`);
    }
    lines.push("");
  }

  if (data.newTrend.length > 0) {
    lines.push("🚀 **신규 트렌드 (기존 도구 외)**");
    for (const r of data.newTrend.slice(0, 8)) {
      lines.push(`• ${r.fullName} ⭐${r.stars} (+${r.starsToday}/day)`);
      if (r.description) lines.push(`  ${r.description}`);
    }
  }

  return lines.join("\n");
}

// MCP 메시지 핸들러
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
          description: "GitHub에서 AI/에이전트/MCP 관련 트렌딩 repo를 수집하고, Ricky 기존 도구와의 연관성을 분류합니다. period: daily | weekly | monthly",
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
    error: { code: -32601, message: "Method not found" }
  };
}

// Vercel 핸들러
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  // SSE 연결 (GET)
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    return;
  }

  // MCP JSON-RPC (POST)
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const result = await handleMCP(body);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).end();
}
