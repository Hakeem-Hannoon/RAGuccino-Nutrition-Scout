import http from "node:http";
import { describeConfig, readConfig } from "./env.mjs";
import { generateAnswer } from "./model.mjs";
import { retrieveContext } from "./search.mjs";

const config = readConfig();

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  return JSON.parse(text);
}

function validateMessages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message) => {
      return (
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string"
      );
    })
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000),
    }))
    .slice(-12);
}

async function handleChat(req, res) {
  const body = await readBody(req);
  const conversation = validateMessages(body.messages);
  const latestUser = [...conversation].reverse().find((message) => message.role === "user");
  if (!latestUser?.content?.trim()) {
    sendJson(res, 400, { error: "messages must include at least one user message" });
    return;
  }

  const retrieval = await retrieveContext({
    question: latestUser.content,
    webSearchEnabled: body.webSearchEnabled !== false,
    config,
  });
  const answer = await generateAnswer({
    question: latestUser.content,
    conversation,
    retrieval,
    config,
  });

  sendJson(res, 200, {
    answer,
    citations: retrieval.citations,
    retrieval: retrieval.retrieval,
  });
}

async function handler(req, res) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "OPTIONS") {
      sendText(res, 204, "");
      return;
    }
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, describeConfig(config));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }
    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    sendJson(res, 500, {
      error: "server_error",
      message: error instanceof Error ? error.message : "Unknown server error",
    });
  }
}

if (process.argv.includes("--check")) {
  console.log(JSON.stringify(describeConfig(config), null, 2));
  process.exit(0);
}

const server = http.createServer(handler);
server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(
      `Port ${config.port} is already in use. Stop the existing server or set PORT to another value in .env.local, for example PORT=8788.`,
    );
    process.exit(1);
  }
  throw error;
});
server.listen(config.port, "0.0.0.0", () => {
  console.log(`RAGuccino API listening on http://0.0.0.0:${config.port}`);
  console.log(JSON.stringify(describeConfig(config), null, 2));
});
