import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// Sync diagnostic log
try {
  fs.writeFileSync(path.join(process.cwd(), 'server_debug.log'), '=== server.ts executed at ' + new Date().toISOString() + ' ===\n');
} catch (e) {
  console.error('Failed to write sync test log:', e);
}

const PORT = 3000;
const app = express();
const server = createServer(app);

// Simple server debug logger to track incoming and upgraded connections
const logFilePath = path.join(process.cwd(), 'server_debug.log');
function writeLog(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, line);
    console.log(message);
  } catch (err) {
    console.error('Failed to write log file:', err);
  }
}

// Initialize a standard WebSocket Server
const wss = new WebSocketServer({ noServer: true });

app.use(express.json());

// Relay In-memory registries
const agentSockets = new Map<string, WebSocket>(); // passcode -> Agent WebSocket
const clientSockets = new Map<string, Set<WebSocket>>(); // passcode -> Set of Browser WebSockets
const pendingRequests = new Map<string, (response: any) => void>(); // reqId -> resolve function


// 1. HTTP API Routes for Cloud Relaying
// When the browser makes a REST API request (e.g., fetch processes), it hits our Node Server first.
// The Node server generates a unique request ID, sends it to the active Python agent WebSocket,
// and awaits the response over the socket, then sends the response back to the browser!
// This fully supports standard fetch / axios without changing the browser's REST paradigm!

// In-memory Mock Data for Direct IP Sandbox mode
const sandboxProcesses = [
  { pid: 14208, name: "valorant.exe", cpu: 14.8, ram: 4120, path: "C:\\Riot Games\\VALORANT\\live\\VALORANT.exe", status: "running" },
  { pid: 8244, name: "discord.exe", cpu: 1.4, ram: 812, path: "C:\\Users\\Gamer\\AppData\\Local\\Discord\\app-1.0.9015\\Discord.exe", status: "running" },
  { pid: 10452, name: "chrome.exe", cpu: 2.8, ram: 2840, path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", status: "running" },
  { pid: 6104, name: "spotify.exe", cpu: 0.1, ram: 244, path: "C:\\Users\\Gamer\\AppData\\Roaming\\Spotify\\Spotify.exe", status: "running" },
  { pid: 2104, name: "steam.exe", cpu: 0.8, ram: 512, path: "C:\\Program Files (x86)\\Steam\\steam.exe", status: "running" },
  { pid: 320, name: "nvidia_container.exe", cpu: 0.1, ram: 45, path: "C:\\Program Files\\NVIDIA Corporation\\Display.NvContainer\\nvcontainer.exe", status: "running" },
  { pid: 212, name: "taskmgr.exe", cpu: 1.1, ram: 142, path: "C:\\Windows\\System32\\taskmgr.exe", status: "running" },
  { pid: 9024, name: "obs64.exe", cpu: 0.2, ram: 618, path: "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe", status: "running" }
];

const sandboxApps = [
  { name: "Command Prompt", id: "cmd.exe", platform: "windows" },
  { name: "PowerShell Terminal", id: "powershell.exe", platform: "windows" },
  { name: "Windows Notepad", id: "notepad.exe", platform: "windows" },
  { name: "Microsoft Calculator", id: "calc.exe", platform: "windows" },
  { name: "MS Paint Canvas", id: "mspaint.exe", platform: "windows" },
  { name: "Windows Task Manager", id: "taskmgr.exe", platform: "windows" },
  { name: "System Control Panel", id: "control.exe", platform: "windows" },
  { name: "Registry Editor", id: "regedit.exe", platform: "windows" },
  { name: "Discord", id: "discord.exe", platform: "windows"},
  { name: "Steam Launcher", id: "steam.exe", platform: "windows"},
  { name: "Google Chrome", id: "chrome.exe", platform: "windows"},
  { name: "Spotify", id: "spotify.exe", platform: "windows"}
];

// Local Sandbox Mock endpoints so the Web App connects and runs flawlessly!
app.post('/api/auth/login', (req, res) => {
  res.json({ token: "local_mock_jwt_secured_token_2026" });
});

app.get('/api/processes', (req, res) => {
  const fluctuated = sandboxProcesses.map(p => {
    let cpuDelta = (Math.random() * 2) - 1.0;
    let newCpu = Math.max(0.1, parseFloat((p.cpu + cpuDelta).toFixed(1)));
    return { ...p, cpu: newCpu };
  });
  res.json(fluctuated);
});

app.get('/api/apps/installed', (req, res) => {
  res.json(sandboxApps);
});

app.post('/api/process/kill', (req, res) => {
  res.json({ status: "success", detail: "Process terminated successfully." });
});

app.post('/api/process/suspend', (req, res) => {
  res.json({ status: "success", detail: "Process state toggled successfully." });
});

app.post('/api/power/action', (req, res) => {
  res.json({ status: "success", detail: "Power action scheduled successfully." });
});

app.post('/api/system/volume', (req, res) => {
  res.json({ status: "success", volume: req.body.volume || 70 });
});

app.post('/api/system/cmd', (req, res) => {
  const cmd = req.body.cmd || '';
  let output = `Executed command: ${cmd}\n\n`;
  if (cmd.toLowerCase().includes('ipconfig')) {
    output += "Windows IP Configuration\n\nEthernet adapter Ethernet 2:\n   IPv4 Address. . . . . . . . . . . : 192.168.1.134\n   Tailscale Address . . . . . . . . : 100.82.112.54";
  } else if (cmd.toLowerCase().includes('whoami')) {
    output += "desktop-pc\\administrator";
  } else if (cmd.toLowerCase() === 'dir') {
    output += " Volume in drive C has no label.\n Directory of C:\\Users\\Gamer\n\n12/05/2026  11:42 AM    <DIR>          .\n12/05/2026  11:42 AM    <DIR>          ..\n12/05/2026  11:44 AM    <DIR>          Desktop\n12/05/2026  11:45 AM    <DIR>          Downloads";
  } else {
    output += `[COMMAND COMPLETED SUCCESSFUL]\nMock stdout output for: "${cmd}"`;
  }
  res.json({ status: "success", output });
});

app.all('/api/relay/:endpoint', async (req, res) => {
  const { endpoint } = req.params;
  const passcode = req.headers['x-passcode'] as string || 'gamingpc123';
  const method = req.method;
  const body = req.body;
  const query = req.query;

  const agent = agentSockets.get(passcode);
  if (!agent || agent.readyState !== WebSocket.OPEN) {
    return res.status(503).json({
      detail: "Physical PC agent is not active or connected to the cloud relay. Check if agent.py is running with outbound cloud relay enabled."
    });
  }

  // Generate unique request ID
  const requestId = Math.random().toString(36).substring(2, 11);

  // Set up the promise for request-response over websocket
  const timeout = setTimeout(() => {
    pendingRequests.delete(requestId);
    res.status(504).json({ detail: "Request to physical PC agent timed out (15s)." });
  }, 15000);

  pendingRequests.set(requestId, (response: any) => {
    clearTimeout(timeout);
    pendingRequests.delete(requestId);
    if (response.status >= 400) {
      res.status(response.status).json({ detail: response.error || "Agent returned an error" });
    } else {
      res.status(response.status || 200).json(response.data);
    }
  });

  // Forward the request to the Python Agent
  agent.send(JSON.stringify({
    type: 'request',
    id: requestId,
    path: `/api/${endpoint}`,
    method,
    body,
    query
  }));
});

// Catch-all relay path for nested endpoints like /api/power/action, /api/process/kill, etc.
app.all('/api/relay/:module/:endpoint', async (req, res) => {
  const { module, endpoint } = req.params;
  const passcode = req.headers['x-passcode'] as string || 'gamingpc123';
  const method = req.method;
  const body = req.body;
  const query = req.query;

  const agent = agentSockets.get(passcode);
  if (!agent || agent.readyState !== WebSocket.OPEN) {
    return res.status(503).json({
      detail: "Physical PC agent is not active or connected to the cloud relay. Check if agent.py is running."
    });
  }

  const requestId = Math.random().toString(36).substring(2, 11);

  const timeout = setTimeout(() => {
    pendingRequests.delete(requestId);
    res.status(504).json({ detail: "Request to physical PC agent timed out (15s)." });
  }, 15000);

  pendingRequests.set(requestId, (response: any) => {
    clearTimeout(timeout);
    pendingRequests.delete(requestId);
    if (response.status >= 400) {
      res.status(response.status).json({ detail: response.error || "Agent returned an error" });
    } else {
      res.status(response.status || 200).json(response.data);
    }
  });

  agent.send(JSON.stringify({
    type: 'request',
    id: requestId,
    path: `/api/${module}/${endpoint}`,
    method,
    body,
    query
  }));
});

// WebSocket Server Handshake Handling
// We coordinate multiple incoming WS requests for agent (outbound tunnel) vs client browser
server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  const pathname = url.split('?')[0];
  const userAgent = request.headers['user-agent'] || 'Unknown-Agent';

  writeLog(`[Relay Upgrade] Received upgrade request for URL: "${url}" (Pathname: "${pathname}") from UA: "${userAgent}"`);

  if (pathname === '/ws/agent-connect' || pathname === '/ws/client-connect') {
    writeLog(`[Relay Upgrade] Routing upgrade handoff for established endpoint "${pathname}"`);
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    writeLog(`[Relay Upgrade] Rejected upgrade request for unhandled endpoint "${pathname}"`);
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket, req) => {
  const url = req.url || '';
  const pathname = url.split('?')[0];
  const queryStr = url.split('?')[1] || '';
  const params = new URLSearchParams(queryStr);
  const passcode = params.get('passcode') || 'gamingpc123';

  writeLog(`[Relay WS Connection] Established socket under path "${pathname}" with passcode "${passcode}"`);

  if (pathname === '/ws/agent-connect') {
    // A physical PC Python agent is connecting outbound to register as active
    console.log(`[Relay] Physical PC Agent registered with passcode: ${passcode}`);
    agentSockets.set(passcode, ws);

    // Broadcast status change to clients
    const clients = clientSockets.get(passcode);
    if (clients) {
      clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) {
          c.send(JSON.stringify({ type: 'agent_status', status: 'online' }));
        }
      });
    }

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message);

        // A response to a pending HTTP REST relay request
        if (payload.type === 'response' && payload.id) {
          const resolver = pendingRequests.get(payload.id);
          if (resolver) {
            resolver(payload);
          }
        } 
        // A live telemetry stats stream broadcast to show in real-time UI
        else if (payload.type === 'stats') {
          const clients = clientSockets.get(passcode);
          if (clients) {
            const dataStr = JSON.stringify(payload);
            clients.forEach(c => {
              if (c.readyState === WebSocket.OPEN) {
                c.send(dataStr);
              }
            });
          }
        }
      } catch (err) {
        console.error('[Relay] Error handling Agent message:', err);
      }
    });

    ws.on('close', () => {
      console.log(`[Relay] Physical PC Agent disconnected for passcode: ${passcode}`);
      if (agentSockets.get(passcode) === ws) {
        agentSockets.delete(passcode);
      }
      // Broadcast status change to clients
      const clients = clientSockets.get(passcode);
      if (clients) {
        clients.forEach(c => {
          if (c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify({ type: 'agent_status', status: 'offline' }));
          }
        });
      }
    });

    ws.on('error', (err) => {
      console.error(`[Relay] Agent connection error:`, err);
    });
  } 
  
  else if (pathname === '/ws/client-connect') {
    // A web browser client is connecting from AI Studio UI
    console.log(`[Relay] UI Client connected under passcode: ${passcode}`);
    if (!clientSockets.has(passcode)) {
      clientSockets.set(passcode, new Set());
    }
    clientSockets.get(passcode)!.add(ws);

    // Send immediate status of the agent to the client
    const isAgentOnline = agentSockets.has(passcode) && agentSockets.get(passcode)!.readyState === WebSocket.OPEN;
    ws.send(JSON.stringify({ 
      type: 'agent_status', 
      status: isAgentOnline ? 'online' : 'offline' 
    }));

    ws.on('message', (message: string) => {
      // If the UI client sends direct live action over WS
      const agent = agentSockets.get(passcode);
      if (agent && agent.readyState === WebSocket.OPEN) {
        agent.send(message); // Forward it directly to the physical agent!
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Physical PC Agent is not active on this tunnel channel.'
        }));
      }
    });

    ws.on('close', () => {
      console.log(`[Relay] UI Client disconnected under passcode: ${passcode}`);
      const clients = clientSockets.get(passcode);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          clientSockets.delete(passcode);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[Relay] Client connection error:`, err);
    });
  }
});

// Setup the development environment / production environments
async function start() {
  if (process.env.NODE_ENV !== "production") {
    // Live development mode: Vite middleware feeds index.html and assets directly
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Deployed production environment
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.all('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    writeLog(`[Relay Server] Listening on http://localhost:${PORT} under NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();
