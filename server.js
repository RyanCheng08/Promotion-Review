const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const stateFile = path.join(root, "review-state.json");
const syncIntervalMs = 10 * 60 * 1000;

let syncInProgress = false;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function defaultState() {
  return {
    known: {},
    starred: {},
    updatedAt: null,
  };
}

function readState() {
  if (!fs.existsSync(stateFile)) return defaultState();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(stateFile, "utf8")));
  } catch {
    return defaultState();
  }
}

function normalizeState(state) {
  return {
    known: state && state.known && typeof state.known === "object" ? state.known : {},
    starred: state && state.starred && typeof state.starred === "object" ? state.starred : {},
    updatedAt: state && state.updatedAt ? state.updatedAt : new Date().toISOString(),
  };
}

function writeState(state) {
  const normalized = normalizeState(state);
  normalized.updatedAt = new Date().toISOString();
  fs.writeFileSync(stateFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    execFile("git", ["-c", `safe.directory=${root}`, ...args], { cwd: root }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function syncGit() {
  if (syncInProgress) return { pushed: false, reason: "sync already running" };
  syncInProgress = true;

  try {
    await runGit(["rev-parse", "--is-inside-work-tree"]);
    await runGit(["add", "review-state.json"]);
    const status = await runGit(["status", "--porcelain", "--", "review-state.json"]);
    if (!status) return { pushed: false, reason: "clean" };

    await runGit(["commit", "-m", "Update review progress"]);
    await runGit(["push"]);
    return { pushed: true };
  } catch (error) {
    return {
      pushed: false,
      error: (error.stderr || error.message || "").trim(),
    };
  } finally {
    syncInProgress = false;
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/state" && request.method === "GET") {
    sendJson(response, 200, readState());
    return;
  }

  if (url.pathname === "/api/state" && request.method === "POST") {
    try {
      writeState(JSON.parse(await readBody(request)));
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/sync" && request.method === "POST") {
    sendJson(response, 200, await syncGit());
    return;
  }

  if (request.method !== "GET") {
    response.writeHead(405);
    response.end("Method not allowed");
    return;
  }

  serveStatic(request, response);
});

server.listen(port, () => {
  console.log(`Promotion Review is running at http://localhost:${port}`);
  console.log(`Progress will be pushed every ${syncIntervalMs / 60000} minutes when git is configured.`);
});

setInterval(() => {
  syncGit().then((result) => {
    if (result.pushed) console.log("Pushed review progress to GitHub.");
    else if (result.error) console.warn(`Git sync skipped: ${result.error}`);
  });
}, syncIntervalMs);
