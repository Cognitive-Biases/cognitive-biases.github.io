import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = normalize(join(process.cwd(), "dist"));
const port = Number(process.env.PORT || 4173);
const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".webp", "image/webp"],
]);

async function sendFile(response, target, status = 200) {
  const info = await stat(target);
  response.writeHead(status, {
    "content-length": info.size,
    "content-type": types.get(extname(target).toLowerCase()) || "application/octet-stream",
  });
  createReadStream(target).pipe(response);
}

async function send404(response) {
  const target = join(root, "404.html");
  try {
    await sendFile(response, target, 404);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
  }
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    const relative = pathname.replace(/^\/+/, "");
    let target = normalize(join(root, relative));
    if (!target.startsWith(root)) throw new Error("Invalid path");

    let info;
    try {
      info = await stat(target);
    } catch {
      await send404(response);
      return;
    }

    if (info.isDirectory()) {
      target = join(target, "index.html");
      try {
        await stat(target);
      } catch {
        await send404(response);
        return;
      }
    }

    await sendFile(response, target, 200);
  } catch {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Bad request\n");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Cognitive Biases dev server: http://127.0.0.1:${port}`);
});
