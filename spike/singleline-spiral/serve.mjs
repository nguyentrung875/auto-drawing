// serve.mjs — Zero-dependency HTTP server for Single-Line Spiral Art Spike
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8077);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" || p === "" || p === "\\") p = "/index.html";
  if (p === "/player.html" || p === "\\player.html") p = "/output/v4/player.html";

  try {
    const filePath = join(ROOT, p);
    const buf = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found — " + p);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌀 Single-Line Spiral Art Spike running on http://localhost:${PORT}/`);
  console.log(`   - Interactive Explorer: http://localhost:${PORT}/`);
  console.log(`   - Champion Demo Player: http://localhost:${PORT}/player.html`);
});
