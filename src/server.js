import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import { calculateDsvPoints, calculateEet, parseTimingText } from "./lib/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-length": Buffer.byteLength(body), ...headers });
  res.end(body);
};

const jsonReplacer = (_key, value) => {
  if (typeof value === "bigint") return value.toString();
  return value;
};

const sendJson = (res, status, obj) => {
  const body = JSON.stringify(obj, jsonReplacer, 2);
  send(res, status, body, { "content-type": "application/json; charset=utf-8" });
};

const contentTypeFor = (p) => {
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
};

const safeJoinPublic = (urlPath) => {
  const cleaned = urlPath.split("?")[0].split("#")[0];
  const rel = cleaned === "/" ? "/index.html" : cleaned;
  const resolved = path.resolve(publicDir, "." + rel);
  if (!resolved.startsWith(publicDir)) return null;
  return resolved;
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      send(res, 400, "Bad Request", { "content-type": "text/plain; charset=utf-8" });
      return;
    }

    if (req.method === "POST" && req.url.startsWith("/api/calc")) {
      const raw = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON request body." });
        return;
      }

      const rows = parseTimingText(payload?.text ?? "");
      const missingBib =
        payload?.missingBib == null || payload?.missingBib === ""
          ? undefined
          : Number(payload.missingBib);

      const result = calculateEet({
        rows,
        missingBib: Number.isFinite(missingBib) ? missingBib : undefined,
        referenceCount: 10
      });

      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && req.url.startsWith("/api/points")) {
      const raw = await readBody(req);
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON request body." });
        return;
      }

      const result = calculateDsvPoints({
        resultsText: payload?.resultsText ?? "",
        startersText: payload?.startersText ?? "",
        useResultsAsStarters: Boolean(payload?.useResultsAsStarters),
        missingPointsAs250: Boolean(payload?.missingPointsAs250),
        fValue: payload?.fValue,
        minSurcharge: payload?.minSurcharge,
        adder: payload?.adder
      });

      sendJson(res, 200, result);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      send(res, 405, "Method Not Allowed", { "content-type": "text/plain; charset=utf-8" });
      return;
    }

    const filePath = safeJoinPublic(req.url);
    if (!filePath) {
      send(res, 404, "Not Found", { "content-type": "text/plain; charset=utf-8" });
      return;
    }

    const data = await readFile(filePath);
    const headers = { "content-type": contentTypeFor(filePath) };
    if (req.method === "HEAD") {
      res.writeHead(200, { ...headers, "content-length": data.byteLength });
      res.end();
      return;
    }
    send(res, 200, data, headers);
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`EET calculator running at http://localhost:${port}`);
});


