# github-trend-mcp

GitHub AI 트렌딩 repo를 수집하는 MCP 서버. Vercel Serverless Function으로 배포.

## 구조

- `api/mcp.js` — MCP 핸들러 (JSON-RPC 2.0, GET=SSE / POST=tool call)
- `package.json` — `"type": "module"` 필수 (ESM, `export default` 사용)

## Git

Git 실행 경로 (시스템 PATH에 없음):
`C:\Users\USER\AppData\Local\GitHubDesktop\app-3.5.11\resources\app\git\cmd\git.exe`

## 배포

Vercel 자동 배포 (GitHub `main` 브랜치 push 시).
프로젝트: `rudd8-bots-projects/github-trend-mcp`

## 주의사항

- `package.json`에 `"type": "module"` 없으면 Vercel이 `api/mcp.js`를 Edge Middleware로 잘못 분류함
