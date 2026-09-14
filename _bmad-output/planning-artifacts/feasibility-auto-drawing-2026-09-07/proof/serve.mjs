// serve.mjs — static server zero-dependency cho proof R0
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const MIME = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8",
               ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
               ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" || p === "") p = "/index.html";
  try {
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { "Content-Type": MIME[extname(p)] || "application/octet-stream",
                         "Cache-Control": "no-store" });
    res.end(buf);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 — " + p);
  }
}).listen(PORT, "0.0.0.0", () =>
  console.log(`Proof R0 serving on http://0.0.0.0:${PORT}/`));
