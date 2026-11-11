// Tiny static server for the prototype — no dependencies.
// Run:  node serve.mjs   then open http://localhost:5173
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT) || 5173;
// Loopback only: with no host, Node listens on every network interface, so anyone on the same
// Wi-Fi could read the project folder. Set HOST=0.0.0.0 to show it on a phone or another machine.
const host = process.env.HOST || "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
  ".json": "application/json", ".woff2": "font/woff2", ".md": "text/markdown; charset=utf-8"
};

createServer(async (req, res) => {
  try {
    // decodeURIComponent throws on malformed escapes (e.g. "/%E0%A4%A"); inside an async
    // handler that would be an unhandled rejection and stop the server.
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = normalize(join(root, path === "/" ? "index.html" : path));
    // Stay inside the project, and never hand out dot-folders (.git holds history and config).
    if (!file.startsWith(root) || file.slice(root.length).split(sep).some((part) => part.startsWith("."))) {
      res.writeHead(403).end(); return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch (err) {
    res.writeHead(err instanceof URIError ? 400 : 404).end(err instanceof URIError ? "Bad request" : "Not found");
  }
}).listen(port, host, () => console.log(`Payment terminal prototype → http://localhost:${port}`));
