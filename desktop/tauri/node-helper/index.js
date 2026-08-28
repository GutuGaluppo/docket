/*
  Lightweight Node helper to run drizzle-kit commands locally.
  WARNING: Running arbitrary CLI commands from an HTTP endpoint is dangerous.
  Use only in a trusted local development environment. Do NOT expose this server on the public internet.

  Usage:
    cd desktop/tauri/node-helper
    npm install
    npm start

  Then POST JSON to http://localhost:4000/run with body { "action": "generate" }
  Supported actions: "generate" (pnpm db:generate), "migrate" (pnpm db:migrate)
*/

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// Root of the project - adjust if necessary
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PORT = 4000;

function runCommand(action, res) {
  const mapping = {
    generate: ['pnpm', ['db:generate']],
    migrate: ['pnpm', ['db:migrate']],
  };

  if (!mapping[action]) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unsupported action' }));
    return;
  }

  const [cmd, args] = mapping[action];
  const proc = spawn(cmd, args, { cwd: PROJECT_ROOT, shell: true });

  let stdout = '';
  let stderr = '';

  proc.stdout.on('data', (d) => { stdout += d.toString(); });
  proc.stderr.on('data', (d) => { stderr += d.toString(); });

  proc.on('close', (code) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code, stdout, stderr }));
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/run') {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        runCommand(payload.action, res);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
      }
    });
    return;
  }

  // health
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('docket-node-helper OK');
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log('docket-node-helper listening on http://localhost:' + PORT);
});
