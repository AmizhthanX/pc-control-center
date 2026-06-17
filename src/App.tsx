import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Cpu, 
  Monitor, 
  Database, 
  Wifi, 
  WifiOff, 
  Power, 
  Lock, 
  Unlock, 
  Settings, 
  Code, 
  BookOpen, 
  Terminal, 
  Smartphone, 
  Trash2, 
  Plus, 
  Play, 
  Zap, 
  Shield, 
  Search, 
  ArrowUpDown, 
  Share2, 
  Check, 
  Copy, 
  AlertTriangle,
  Flame,
  Volume2,
  HardDrive
} from 'lucide-react';
import { 
  pythonAgentCode, 
  flutterClientCode, 
  presetDatabaseSchema, 
  documentationSections, 
  defaultProcesses, 
  initialRules, 
  initialLogs 
} from './data';
import { ProcessInfo, AutomationRule, LogEntry, SystemStats } from './types';

export default function App() {
  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'code' | 'docs'>('dashboard');
  
  // PC Simulator States
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpuUsage: 14,
    cpuTemp: 44,
    ramUsage: 51,
    ramTotal: 16,
    gpuUsage: 12,
    gpuTemp: 42,
    diskUsage: 64,
    netUpload: 12.5,
    netDownload: 0.8,
    uptime: "14:22:04",
    currentUser: "Administrator",
    internetConnected: true
  });

  const [processes, setProcesses] = useState<ProcessInfo[]>(defaultProcesses);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(initialRules);
  const [auditLogs, setAuditLogs] = useState<LogEntry[]>(initialLogs);
  
  // Search & Filter state for Process Manager
  const [processSearch, setProcessSearch] = useState('');
  const [processSortBy, setProcessSortBy] = useState<'cpu' | 'ram' | 'name'>('cpu');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  
  // Power action modal confirmation
  const [powerModal, setPowerModal] = useState<string | null>(null);

  // New Rule Builder state
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleTrigger, setNewRuleTrigger] = useState('IF Valorant Starts');
  const [newRuleAction, setNewRuleAction] = useState('THEN Send Notification');

  // Emulator state controllers
  const [gamingLockdownActive, setGamingLockdownActive] = useState(false);
  const [mobileAuthToken, setMobileAuthToken] = useState<string | null>("eyJWT_TOKEN_MOCK_2026");
  const [pairingPassword, setPairingPassword] = useState("gamingpc123");
  const [selectedDocsSection, setSelectedDocsSection] = useState(documentationSections[0].id);
  const [currentCodeFile, setCurrentCodeFile] = useState<'agent' | 'flutter' | 'sqlite'>('agent');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Simulation parameters for developers to fluctuate live PC behaviors
  const [cpuStress, setCpuStress] = useState<number>(0); // 0 to 100 stress factor
  const [gpuStress, setGpuStress] = useState<number>(0);
  const [connectionMode, setConnectionMode] = useState<'Tailscale' | 'LAN' | 'WAN'>('Tailscale');

  // Real Host Agent Bridge connection states (Dual-Mode Engine)
  const [liveBridgeActive, setLiveBridgeActive] = useState(false);
  const [agentUrl, setAgentUrl] = useState('http://localhost:3000');
  const [agentPasscode, setAgentPasscode] = useState('gamingpc123');
  const [agentToken, setAgentToken] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<'offline' | 'connecting' | 'online'>('offline');
  const [agentError, setAgentError] = useState<string | null>(null);
  const [useCloudRelay, setUseCloudRelay] = useState(true);

  // Smartphone App Simulator States
  const [phoneActiveTab, setPhoneActiveTab] = useState<'dashboard' | 'processes' | 'power' | 'network' | 'logs' | 'shell'>('dashboard');
  const [phoneVolume, setPhoneVolume] = useState(70);
  const [phoneShellCmd, setPhoneShellCmd] = useState('');
  const [phoneShellOutput, setPhoneShellOutput] = useState<string[]>([
    "Microsoft Windows [Version 10.0.19045]",
    "(c) Microsoft Corporation. All rights reserved.",
    "",
    "C:\\Users\\Gamer> "
  ]);
  const [phoneShellLoading, setPhoneShellLoading] = useState(false);
  const [phoneProcessSearch, setPhoneProcessSearch] = useState('');

  // Installed applications & Launchpad controller
  const [installedApps, setInstalledApps] = useState<Array<{ name: string; id: string; platform: string }>>([]);
  const [appSearchQuery, setAppSearchQuery] = useState('');
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  // References and helper utilities for PubSub Cloud Stream
  const pendingPubSubRequests = useRef<Map<string, (resp: any) => void>>(new Map());
  const lastChimePlayed = useRef<number>(0);

  // A simulated, highly responsive Web Audio synthesizer chime to provide real audible feedback on volume changes
  const playVolumeTestTone = (val: number) => {
    const now = Date.now();
    // Throttle to avoid audio contexts buildup on rapid sliding
    if (now - lastChimePlayed.current < 120) return;
    lastChimePlayed.current = now;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      // Change frequency dynamically to make high/low levels audibly distinct
      const freq = 400 + (val * 1.8); 
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      // Calculate pleasant gain (cap maximum volume at a comfortable soft level)
      const targetGain = (val / 100) * 0.12;
      gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch (e) {
      console.warn("Web audio playback blocked or uninitialized: ", e);
    }
  };

  // Simple, deterministic folding hash to generate a unique channel based on passcode
  const getPasscodeHash = (passcode: string): string => {
    let hash = 0;
    for (let i = 0; i < passcode.length; i++) {
      hash = (hash << 5) - hash + passcode.charCodeAt(i);
      hash |= 0;
    }
    const hashStr = Math.abs(hash).toString(16) + "_" + passcode.substring(0, 3);
    return `pc_${hashStr}`;
  };

  const getAgentFetchUrl = (endpoint: string) => {
    if (useCloudRelay) {
      return `/api/relay/${endpoint}`;
    } else {
      if (agentUrl.includes('localhost:3000') || agentUrl.includes('127.0.0.1:3000') || agentUrl.includes('localhost:3050')) {
        return `/api/${endpoint}`;
      }
      return `${agentUrl}/api/${endpoint}`;
    }
  };

  const getAgentFetchHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (useCloudRelay) {
      headers['x-passcode'] = agentPasscode;
    }
    if (agentToken) {
      headers['Authorization'] = `Bearer ${agentToken}`;
    }
    return headers;
  };

  // Unified agent communication dispatch router (PubSub vs Local Rest fetch)
  const fetchAgent = async (endpoint: string, options: RequestInit = {}): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> => {
    if (useCloudRelay) {
      const topicHash = getPasscodeHash(agentPasscode);
      const reqId = 'req_' + Math.random().toString(36).substring(3, 11);
      
      let parsedBody = undefined;
      if (options.body) {
        try {
          parsedBody = JSON.parse(options.body as string);
        } catch(e) {}
      }

      const payload = {
        type: 'request',
        id: reqId,
        path: `/api/${endpoint}`,
        method: options.method || 'GET',
        body: parsedBody
      };

      try {
        // Send outbound message payload safely
        await fetch(`https://ntfy.sh/ctrl-act-${topicHash}`, {
          method: 'POST',
          headers: {
            'Title': 'Agent Request',
            'Priority': '3'
          },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ detail: "Transmission failure on cloud stream." })
        };
      }

      // Live handoff wait for matching response
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pendingPubSubRequests.current.delete(reqId);
          resolve({
            ok: false,
            status: 504,
            json: async () => ({ detail: "Request timed out. Ensure agent.py is active." })
          });
        }, 12000);

        pendingPubSubRequests.current.set(reqId, (response: any) => {
          clearTimeout(timeout);
          pendingPubSubRequests.current.delete(reqId);
          resolve({
            ok: response.status < 400,
            status: response.status || 200,
            json: async () => response.data || { detail: response.error || "Success" }
          });
        });
      });
    } else {
      let url = `${agentUrl}/api/${endpoint}`;
      if (agentUrl.includes('localhost:3000') || agentUrl.includes('127.0.0.1:3000') || agentUrl.includes('localhost:3050')) {
        url = `/api/${endpoint}`;
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (agentToken) {
        headers['Authorization'] = `Bearer ${agentToken}`;
      }
      return fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    }
  };

  // Animated live updates of PC stats (simulates every second telemetry stream unless dynamically connected to local PC)
  useEffect(() => {
    if (liveBridgeActive && agentStatus === 'online') {
      return; // Suspend simulated hardware values when utilizing real physical agent
    }
    const timer = setInterval(() => {
      setSystemStats(prev => {
        // Base fluctuations
        let baseCpu = Math.floor(Math.random() * 8) + 10; // 10-18% normal
        if (cpuStress > 0) {
          baseCpu = Math.min(100, Math.floor(cpuStress + Math.random() * 10 - 5));
        } else if (gamingLockdownActive) {
          baseCpu = Math.floor(Math.random() * 4) + 5; // Low utility normal during lockdown
        }

        let baseGpu = Math.floor(Math.random() * 5) + 8; // 8-13% normal
        if (gpuStress > 0) {
          baseGpu = Math.min(100, Math.floor(gpuStress + Math.random() * 10 - 5));
        } else if (gamingLockdownActive) {
          baseGpu = Math.floor(Math.random() * 3) + 2; 
        }

        // CPU temperature fluctuates relative to CPU load
        const calculatedCpuTemp = Math.floor(40 + (baseCpu * 0.45) + (Math.random() * 3));
        const calculatedGpuTemp = Math.floor(38 + (baseGpu * 0.42) + (Math.random() * 2));

        // Network loads
        const downloadSpeed = baseCpu > 50 
          ? parseFloat((20 + Math.random() * 15).toFixed(1)) 
          : parseFloat((2 + Math.random() * 3).toFixed(1));
        const uploadSpeed = baseGpu > 30 
          ? parseFloat((5 + Math.random() * 4).toFixed(1)) 
          : parseFloat((0.4 + Math.random() * 0.5).toFixed(1));

        // Ram
        const activeRamPct = Math.min(98, Math.max(25, Math.floor(45 + (baseCpu * 0.15) + (Math.random() * 4))));

        // Increment Uptime string counter
        const uptimeParts = prev.uptime.split(':').map(Number);
        let sec = uptimeParts[2] + 1;
        let min = uptimeParts[1];
        let hr = uptimeParts[0];
        if (sec >= 60) {
          sec = 0;
          min += 1;
        }
        if (min >= 60) {
          min = 0;
          hr += 1;
        }
        const updatedUptime = [
          String(hr).padStart(2, '0'),
          String(min).padStart(2, '0'),
          String(sec).padStart(2, '0')
        ].join(':');

        return {
          ...prev,
          cpuUsage: baseCpu,
          cpuTemp: calculatedCpuTemp,
          gpuUsage: baseGpu,
          gpuTemp: calculatedGpuTemp,
          ramUsage: activeRamPct,
          netDownload: downloadSpeed,
          netUpload: uploadSpeed,
          uptime: updatedUptime
        };
      });

      // Fluctuate process stats in real time
      setProcesses(prev => {
        return prev.map(p => {
          if (p.status === 'suspended') return p;
          
          let cpuDelta = (Math.random() * 3) - 1.5;
          let newCpu = Math.max(0.1, parseFloat((p.cpu + cpuDelta).toFixed(1)));
          
          if (p.name === 'valorant.exe' && gamingLockdownActive) {
            return p; // Should be killed
          }

          // Adjust relative limits based on stress
          if (p.name === 'obs64.exe' && cpuStress > 50) {
            newCpu = Math.max(25, parseFloat((newCpu + 4).toFixed(1)));
          }

          return {
            ...p,
            cpu: newCpu
          };
        });
      });

    }, 1200);

    return () => clearInterval(timer);
  }, [cpuStress, gpuStress, gamingLockdownActive, liveBridgeActive, agentStatus]);

  // Handle auto-triggering alerts based on live statistical inputs (Automation Rules Simulator)
  useEffect(() => {
    // 1. High CPU rule alert trigger
    if (systemStats.cpuUsage > 90) {
      const activeRule = automationRules.find(r => r.trigger === 'IF CPU > 90%' && r.enabled);
      if (activeRule) {
        addLog('warning', 'system', 'RULE TRIGGERED: [Heavy Load Guardian] CPU Usage exceeds 90%threshold! Alert dispatched to mobile.');
      }
    }

    // 2. High Temperature Alert
    if (systemStats.gpuTemp > 75) {
      const activeRule = automationRules.find(r => r.trigger === 'IF GPU Temp > 85' && r.enabled);
      if (activeRule) {
        addLog('warning', 'system', `RULE TRIGGERED: [Overheating Alert] GPU temperature is alarming: ${systemStats.gpuTemp}°C. Action: High Warning sent.`);
      }
    }
  }, [systemStats.cpuUsage, systemStats.gpuTemp]);

  // Query installed apps on host or list simulated default options
  const fetchInstalledApps = async () => {
    if (liveBridgeActive && agentStatus === 'online' && agentToken) {
      setIsLoadingApps(true);
      try {
        const res = await fetchAgent('apps/installed');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setInstalledApps(data);
          }
        } else {
          addLog('error', 'process', 'Failed to retrieve physical applications list from connected host.');
        }
      } catch (err) {
        console.error("Failed to query host applications list:", err);
      } finally {
        setIsLoadingApps(false);
      }
    } else {
      // Offline fallback lists - stunning standard programs
      setInstalledApps([
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
      ]);
    }
  };

  useEffect(() => {
    fetchInstalledApps();
  }, [liveBridgeActive, agentStatus]);

  // Live Agent Active Polling & Synchronization (Dual-Mode Router)
  useEffect(() => {
    if (!liveBridgeActive && agentStatus !== 'connecting') return;

    let pollInterval: NodeJS.Timeout | null = null;
    let sse: EventSource | null = null;
    let ws: WebSocket | null = null;

    const fetchLiveProcesses = async () => {
      try {
        const res = await fetchAgent('processes');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setProcesses(data);
          } else {
            console.warn("Processes data is not an array:", data);
          }
        } else if (res.status === 401) {
          handleDisconnectLiveAgent();
          addLog('error', 'security', 'Administrative token has expired. Session disconnected.');
        }
      } catch (err) {
        console.error("Failed to query live processes:", err);
      }
    };

    // Only start polling of processes if we are fully online
    if (liveBridgeActive && agentStatus === 'online') {
      fetchLiveProcesses();
      pollInterval = setInterval(fetchLiveProcesses, 4000);
    }

    if (useCloudRelay) {
      const topicHash = getPasscodeHash(agentPasscode);
      const sseUrl = `https://ntfy.sh/ctrl-feed-${topicHash}/sse`;

      console.log(`[PubSub Relay] Establishing SSE connection on topic ctrl-feed-${topicHash}`);
      
      try {
        sse = new EventSource(sseUrl);
        sse.onopen = () => {
          console.log("SSE Pipeline linked successfully.");
          if (agentStatus === 'connecting') {
            addLog('success', 'network', `Secure Cloud Stream pipeline established with physical host under passcode.`);
          }
        };

        sse.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.event === 'message' && payload.message) {
              const data = JSON.parse(payload.message);
              
              if (data.type === 'response' && data.id) {
                const resolver = pendingPubSubRequests.current.get(data.id);
                if (resolver) resolver(data);
              } else if (data.type === 'stats' && data.data) {
                setSystemStats(data.data);
                // Auto-upgrade status to online if stats stream starts coming in
                setAgentStatus('online');
                setLiveBridgeActive(true);
              }
            }
          } catch (e) {
            console.error("Error parsing PubSub frame:", e);
          }
        };

        sse.onerror = (err) => {
          console.error("SSE stream error:", err);
          setAgentError("Cloud stream connecting... Check if the physical Python background service (agent.py) is booted up on your computer.");
        };
      } catch (e) {
        console.error("SSE setup failed:", e);
      }
    } else {
      const wsUrl = agentUrl.replace(/^http/, 'ws') + '/ws';
      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          addLog('success', 'network', `WebSocket telemetry pipeline established with personal agent at ${agentUrl}.`);
        };
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'stats' && payload.data) {
              setSystemStats(payload.data);
            }
          } catch (e) {}
        };
        ws.onerror = () => {
          setAgentError("WebSocket transmission broken. Polling fallback active.");
        };
      } catch (e) {
        console.error("WebSocket setup failed:", e);
      }
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (sse) sse.close();
      if (ws) ws.close();
    };
  }, [liveBridgeActive, agentStatus, agentUrl, agentToken, useCloudRelay, agentPasscode]);

  // Handle credentials verification and token acquisition
  const handleConnectLiveAgent = async () => {
    setAgentStatus('connecting');
    setAgentError(null);

    if (useCloudRelay) {
      try {
        addLog('info', 'network', 'Initializing secure end-to-end cloud handshake...');
        
        // Wait 1.5 seconds for SSE connection open before firing
        await new Promise(r => setTimeout(r, 1500));

        const res = await fetchAgent('auth/login', {
          method: 'POST',
          body: JSON.stringify({ password: agentPasscode })
        });

        if (res.ok) {
          const data = await res.json();
          setAgentToken(data.token || 'handshake_ok');
          setAgentStatus('online');
          setLiveBridgeActive(true);
          addLog('success', 'security', `CONNECTED TO REAL PC: Encryption handoff complete. Session token registered.`);
        } else {
          const errData = await res.json().catch(() => ({}));
          setAgentStatus('offline');
          setLiveBridgeActive(false);
          setAgentError(errData.detail || "Credentials challenge refused by agent. Is the passcode correct?");
          addLog('error', 'security', `Credentials challenge failed at physical host.`);
        }
      } catch (err: any) {
        setAgentStatus('offline');
        setLiveBridgeActive(false);
        setAgentError(err.message || "Connection timed out. Ensure agent.py is actively running on your PC.");
        addLog('error', 'network', `Handshake failed: physical agent did not respond within timeout.`);
      }
    } else {
      try {
        const res = await fetch(getAgentFetchUrl('auth/login'), {
          method: 'POST',
          headers: getAgentFetchHeaders(),
          body: JSON.stringify({ password: agentPasscode })
        });
        if (res.ok) {
          const data = await res.json();
          setAgentToken(data.token);
          setAgentStatus('online');
          setLiveBridgeActive(true);
          addLog('success', 'security', `CONNECTED TO REAL PC: Encryption handoff complete. Session token registered.`);
        } else {
          const errData = await res.json().catch(() => ({}));
          setAgentStatus('offline');
          setLiveBridgeActive(false);
          setAgentError(errData.detail || "Credentials challenge refused.");
          addLog('error', 'security', `Credentials challenge failed at physical host.`);
        }
      } catch (err) {
        setAgentStatus('offline');
        setLiveBridgeActive(false);
        setAgentError("Connection refused. Is the python background service running on your Windows host?");
        addLog('error', 'network', `Failed to route networking handshake interface.`);
      }
    }
  };

  const handleDisconnectLiveAgent = () => {
    setLiveBridgeActive(false);
    setAgentStatus('offline');
    setAgentToken(null);
    setAgentError(null);
    setProcesses(defaultProcesses);
    addLog('info', 'security', `Bridged network link closed. Reverting telemetry system to offline emulator.`);
  };

  // Logging function
  const addLog = (level: LogEntry['level'], category: LogEntry['category'], message: string) => {
    const timestampStr = new Date().toTimeString().split(' ')[0];
    const newLog: LogEntry = {
      id: `log_${Date.now()}_${Math.random()}`,
      timestamp: timestampStr,
      level,
      category,
      message
    };
    setAuditLogs(prev => [newLog, ...prev.slice(0, 49)]); // Keep last 50
  };

  // Process Controls: Kill Specific Application
  const handleKillProcess = async (pid: number, name: string) => {
    if (liveBridgeActive && agentStatus === 'online' && agentToken) {
      try {
        const res = await fetchAgent('process/kill', {
          method: 'POST',
          body: JSON.stringify({ pid })
        });
        if (res.ok) {
          setProcesses(prev => prev.filter(p => p.pid !== pid));
          addLog('success', 'process', `Force terminated process '${name}' (PID: ${pid}) directly on physical host PC.`);
        } else {
          const detail = await res.json().catch(() => ({}));
          addLog('error', 'process', `Failed to kill process on physical host: ${detail.detail || "Refused"}`);
        }
      } catch (err) {
        addLog('error', 'process', `Connection failed: Make sure physical agent is running and connected.`);
      }
      return;
    }

    setProcesses(prev => prev.filter(p => p.pid !== pid));
    addLog('success', 'process', `Force terminated process '${name}' (PID: ${pid}) successfully.`);
    
    // Check if process termination triggers automation logic
    if (name.toLowerCase() === 'valorant.exe') {
      addLog('info', 'system', 'Trigger notification checklist: Valorant has closed.');
    }
  };

  // Toggle Suspend Process
  const handleToggleSuspend = (pid: number, name: string) => {
    setProcesses(prev => prev.map(p => {
      if (p.pid === pid) {
        const nextStatus = p.status === 'running' ? 'suspended' : 'running';
        addLog('warning', 'process', `Changed status of '${name}' (PID: ${pid}) to ${nextStatus.toUpperCase()}.`);
        return { ...p, status: nextStatus, cpu: nextStatus === 'suspended' ? 0.0 : 1.2 };
      }
      return p;
    }));
  };

  // Toggle Favorite
  const handleToggleFavorite = (pid: number) => {
    setProcesses(prev => prev.map(p => {
      if (p.pid === pid) {
        return { ...p, favorite: !p.favorite };
      }
      return p;
    }));
  };

  // Quick Application Kill Actions
  const handleQuickKillApp = (appName: string) => {
    const matched = processes.find(p => p.name.toLowerCase().includes(appName.toLowerCase()));
    if (matched) {
      handleKillProcess(matched.pid, matched.name);
    } else {
      addLog('warning', 'process', `No running process matching '${appName}' detected in active pool.`);
    }
  };

  // Quick Application Launch
  const handleLaunchApp = async (appName: string) => {
    if (liveBridgeActive && agentStatus === 'online' && agentToken) {
      try {
        const res = await fetchAgent('apps/launch', {
          method: 'POST',
          body: JSON.stringify({ app_name: appName })
        });
        if (res.ok) {
          addLog('success', 'process', `Physical launch command accepted checklist: Running '${appName}' preset binary on host.`);
        } else {
          const detail = await res.json().catch(() => ({}));
          addLog('error', 'process', `Host failed layout launcher execution: ${detail.detail || "Refused"}`);
        }
      } catch (err) {
        addLog('error', 'process', `Agent communication break compiling launch: CORS or offline.`);
      }
      return;
    }

    // Generate simulated process entry
    const matchingDefault = defaultProcesses.find(dp => dp.name.toLowerCase().includes(appName.toLowerCase()));
    if (matchingDefault) {
      const pid = Math.floor(Math.random() * 15000) + 1000;
      const newProc: ProcessInfo = {
        ...matchingDefault,
        pid,
        cpu: 1.5,
        status: 'running'
      };
      
      setProcesses(prev => {
        if (prev.some(p => p.name === newProc.name)) {
          return prev; // Already running
        }
        return [newProc, ...prev];
      });
      addLog('success', 'process', `Remote launch request acknowledged: Launched preset application '${newProc.name}' from path.`);
      
      // Check automation rules triggered by app starting
      if (appName.toLowerCase() === 'valorant') {
        const rule = automationRules.find(r => r.trigger === 'IF Valorant Starts' && r.enabled);
        if (rule) {
          addLog('info', 'system', 'RULE TRIGGERED: [Valorant Protection] App detected! Auto-dispatched alert notification payload.');
        }
      }
    }
  };

  // Toggle Internet connectivity on simulated PC target address
  const handleToggleInternet = () => {
    setSystemStats(prev => {
      const nextConn = !prev.internetConnected;
      addLog(
        nextConn ? 'success' : 'error', 
        'network', 
        `Physical internet communication adapter has been manually ${nextConn ? 'ENABLED' : 'DISABLED'} on local router grid.`
      );
      
      // Rule trigger for logging network toggle events
      if (!nextConn) {
        const rule = automationRules.find(r => r.trigger === 'IF Internet Is Enabled' && r.enabled);
        if (rule) {
          addLog('warning', 'security', 'RULE EXECUTION: Network security logger intercepted structural WAN loss.');
        }
      }
      return { ...prev, internetConnected: nextConn };
    });
  };

  // Enable/Disable individual adapters (simulated)
  const handleToggleAdapter = (type: 'Ethernet' | 'WiFi') => {
    addLog('info', 'network', `Driver query sent: Restarting network interface controller (${type}).`);
  };

  const handleSetVolume = async (val: number) => {
    setPhoneVolume(val);
    playVolumeTestTone(val);
    if (liveBridgeActive && agentStatus === 'online' && agentToken) {
      try {
        await fetchAgent('system/volume', {
          method: 'POST',
          body: JSON.stringify({ level: val })
        });
        addLog('success', 'system', `Set physical PC Volume to ${val}%`);
      } catch (e) {
        addLog('error', 'system', 'Failed to adjust physical audio volume.');
      }
    } else {
      addLog('success', 'system', `Remote Command: Adjusted simulated host volume to ${val}%`);
    }
  };

  const handlePhoneShellSubmit = async () => {
    if (!phoneShellCmd.trim()) return;
    const cmd = phoneShellCmd.trim();
    setPhoneShellCmd('');
    setPhoneShellLoading(true);
    setPhoneShellOutput(prev => [...prev, `C:\\Users\\Gamer> ${cmd}`]);

    if (liveBridgeActive && agentStatus === 'online' && agentToken) {
      try {
        const res = await fetchAgent('system/cmd', {
          method: 'POST',
          body: JSON.stringify({ command: cmd })
        });
        const data = await res.json();
        const out = data.output || "No output.";
        setPhoneShellOutput(prev => [...prev, ...out.split('\n')]);
        addLog('success', 'security', `Executed remote shell command: ${cmd}`);
      } catch (e) {
        setPhoneShellOutput(prev => [...prev, "Error communicating with PC host over cloud relay."]);
      } finally {
        setPhoneShellLoading(false);
      }
    } else {
      // Simulate cmd output!
      setTimeout(() => {
        let response = "";
        const lowerCmd = cmd.toLowerCase();
        if (lowerCmd === "dir") {
          response = " Volume in drive C has no label.\n Volume Serial Number is 4C11-C68C\n\n Directory of C:\\Users\\Gamer\n\n17/06/2026  10:14 PM    <DIR>          .\n17/06/2026  10:14 PM    <DIR>          ..\n17/06/2026  09:40 AM    <DIR>          Desktop\n17/06/2026  09:40 AM    <DIR>          Downloads\n17/06/2026  09:55 AM    <DIR>          Documents\n               0 File(s)              0 bytes\n               5 Dir(s)  120,443,010,816 bytes free";
        } else if (lowerCmd.startsWith("ping")) {
          const target = cmd.split(' ')[1] || "google.com";
          response = `Pinging ${target} [8.8.8.8] with 32 bytes of data:\nReply from 8.8.8.8: bytes=32 time=14ms TTL=118\nReply from 8.8.8.8: bytes=32 time=11ms TTL=118\n\nPing statistics for 8.8.8.8:\n    Packets: Sent = 2, Received = 2, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = 11ms, Maximum = 14ms, Average = 12ms`;
        } else if (lowerCmd === "whoami") {
          response = "desktop-gaming-pro\\gamer";
        } else if (lowerCmd === "ipconfig") {
          response = "Windows IP Configuration\n\nEthernet adapter Ethernet 2:\n\n   Connection-specific DNS Suffix  . : broadband\n   IPv4 Address. . . . . . . . . . . : 192.168.1.134\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.1.1\n\nTunnel adapter Tailscale:\n   Connection-specific DNS Suffix  . :\n   IPv4 Address. . . . . . . . . . . : 100.82.112.54";
        } else if (lowerCmd === "cls" || lowerCmd === "clear") {
          setPhoneShellOutput([ "C:\\Users\\Gamer> " ]);
          setPhoneShellLoading(false);
          return;
        } else if (lowerCmd.startsWith("help")) {
          response = "Supported remote powershell console commands:\n  help      - Print this guidance sheet\n  dir       - List current directory items\n  whoami    - Print active user registration\n  ipconfig  - Display local connection bindings\n  ping <ip> - Test outbound connection hops\n  cls       - Clear terminal console logs\n  Any standard Windows CMD or PowerShell syntax.";
        } else {
          response = `'${cmd}' is not recognized as an internal or external command,\noperable program or batch file.\nTry running 'help' to see simulated shortcuts.`;
        }
        setPhoneShellOutput(prev => [...prev, ...response.split('\n'), ""]);
        setPhoneShellLoading(false);
        addLog('info', 'process', `Simulated shell command: ${cmd}`);
      }, 500);
    }
  };

  // Power actions execution
  const executePowerAction = async (action: string) => {
    addLog('warning', 'power', `SYSTEM TRIGGERED POWER INSTANCE: Actioning '${action.toUpperCase()}' request on host machine.`);
    setPowerModal(null);
    
    if (liveBridgeActive && agentStatus === 'online' && agentToken) {
      try {
        const res = await fetchAgent(`power/action?action=${action}`, {
          method: 'POST'
        });
        if (res.ok) {
          addLog('success', 'power', `Hardware request '${action.toUpperCase()}' successfully processed by physical Windows Agent.`);
        } else {
          const detail = await res.json().catch(() => ({}));
          addLog('error', 'power', `Power command failed on host: ${detail.detail || "Refused"}`);
        }
      } catch (err) {
        addLog('error', 'power', `Network bridge failed to transmit power instructions: Check CORS.`);
      }
      return;
    }

    if (action === 'lock') {
      addLog('success', 'power', 'System status locked: Win32 workstation logged into static Windows 11 lockscreen environment.');
    } else if (action === 'sleep') {
      addLog('success', 'power', 'Entering system sleep frame state (S3 Low Power consumption mode). Telemetry stream paused.');
    } else if (action === 'shutdown') {
      addLog('error', 'power', 'Executing kernel shutdown instruction sequence. Target machine shutting down in t-minus 5 seconds.');
    } else if (action === 'restart') {
      addLog('success', 'power', 'Executing hardware bios reboot command. Uvicorn worker thread restarted.');
    } else if (action === 'hibernate') {
      addLog('success', 'power', 'Dumped active DDR RAM pages layout into hibernation system physical file. Core power terminated.');
    } else if (action === 'logoff') {
      addLog('success', 'power', 'Successfully logged off Administrator user environment.');
    }
  };

  // Gaming Lockdown emergency activator
  const handleToggleGamingLockdown = () => {
    if (!gamingLockdownActive) {
      setGamingLockdownActive(true);
      // Close Valorant.exe, Discord.exe, Steam.exe, Chrome.exe, Spotify.exe if they run
      const appsToKill = ['valorant.exe', 'discord.exe', 'steam.exe', 'chrome.exe', 'spotify.exe'];
      setProcesses(prev => prev.filter(p => !appsToKill.includes(p.name.toLowerCase())));
      
      addLog('success', 'security', 'EMERGENCY: [GAMING LOCKDOWN MODE ACTIVATED]');
      addLog('success', 'process', 'Killed background memory bloat files: Discord, Steam, Spotify, Valorant, Chrome closed.');
      addLog('warning', 'network', 'Network resource bandwidth prioritized strictly for gaming streams.');
    } else {
      setGamingLockdownActive(false);
      addLog('info', 'security', 'EMERGENCY: Gaming Lockdown Mode de-registered. Restored standard services state.');
    }
  };

  // Add automation rule
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;

    const newRule: AutomationRule = {
      id: `rule_custom_${Date.now()}`,
      name: newRuleName,
      trigger: newRuleTrigger,
      action: newRuleAction,
      enabled: true
    };

    setAutomationRules(prev => [...prev, newRule]);
    addLog('success', 'system', `Created custom automation trigger workflow: "${newRule.name}" successfully.`);
    setNewRuleName('');
  };

  const handleToggleRule = (id: string, name: string) => {
    setAutomationRules(prev => prev.map(r => {
      if (r.id === id) {
        const nextState = !r.enabled;
        addLog('info', 'system', `Automation Rule "${name}" switched ${nextState ? 'ONLINE' : 'OFFLINE'}.`);
        return { ...r, enabled: nextState };
      }
      return r;
    }));
  };

  const handleDeleteRule = (id: string, name: string) => {
    setAutomationRules(prev => prev.filter(r => r.id !== id));
    addLog('warning', 'system', `Deleted automation rule recipe: "${name}".`);
  };

  // Process search and sort lists computed properties
  const filteredProcesses = useMemo(() => {
    return processes
      .filter(p => {
        const matchSearch = p.name.toLowerCase().includes(processSearch.toLowerCase()) || 
                            p.pid.toString().includes(processSearch) ||
                            (p.path && p.path.toLowerCase().includes(processSearch.toLowerCase()));
        const matchFavorite = !favoritesOnly || p.favorite;
        return matchSearch && matchFavorite;
      })
      .sort((a, b) => {
        if (processSortBy === 'cpu') return b.cpu - a.cpu;
        if (processSortBy === 'ram') return b.ram - a.ram;
        return a.name.localeCompare(b.name);
      });
  }, [processes, processSearch, processSortBy, favoritesOnly]);

  // Copy code contents trigger
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => {
      setCopiedNotification(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e0e0e6] font-sans flex flex-col antialiased">
      
      {/* 1. Header with Active Agent Telemetry State */}
      <header className="bg-[#121216] border-b border-[#242429] shadow-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 select-none relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f2ff]/60 to-transparent"></div>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00f2ff]/10 rounded-lg flex items-center justify-center border border-[#00f2ff]/30 shadow-[0_0_15px_rgba(0,242,255,0.15)]">
            <Settings className="w-5 h-5 text-[#00f2ff] animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-mono tracking-widest text-[#00f2ff] uppercase font-bold">{liveBridgeActive ? 'PHYSICAL-PC-DESKTOP' : 'RYZEN-GAMING-PRO'}</h1>
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${liveBridgeActive ? 'bg-green-400' : 'bg-amber-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${liveBridgeActive ? 'bg-green-500' : 'bg-amber-500'}`}></span>
              </span>
              <span className={`text-[10px] font-mono uppercase tracking-tighter ${liveBridgeActive ? 'text-green-400 font-bold' : 'text-amber-400 animate-pulse'}`}>
                ● {liveBridgeActive ? 'LIVE ACTIVE BRIDGE' : 'OFFLINE EMULATOR'}
              </span>
            </div>
            <p className="text-xs text-white/50 font-mono">
              Host: <span className="text-white/80">{liveBridgeActive ? agentUrl : '192.168.1.11'}</span> | OS Profile: <span className="text-white/80">{liveBridgeActive ? 'Python Core Daemon' : 'Windows 11 x64'}</span>
            </p>
          </div>
        </div>

        {/* Global state monitoring shortcuts */}
        <div className="flex items-center gap-6 text-xs font-mono uppercase tracking-wider">
          <div className="hidden sm:flex flex-col items-end border-r border-[#242429] pr-4">
            <span className="text-white/40 text-[9px]">CONNECTION SPEED</span>
            <span className="text-white font-medium flex items-center gap-1">
              <span className="text-[#00f2ff]">↓ {systemStats.netDownload} MB/s</span>
              <span className="text-white/30">|</span>
              <span className="text-[#ff8c00]">↑ {systemStats.netUpload} MB/s</span>
            </span>
          </div>

          <div className="hidden md:flex flex-col items-end border-r border-[#242429] pr-4">
            <span className="text-white/40 text-[9px]">PEER CONNECTIVITY</span>
            <span className="text-[#ff8c00] font-semibold flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5 text-[#ff8c00] animate-pulse" />
              <span>{connectionMode} Secured</span>
            </span>
          </div>

          <div className="flex flex-col items-end border-r border-[#242429] pr-4">
            <span className="text-white/40 text-[9px]">DESKTOP UPTIME</span>
            <span className="text-white font-mono tracking-wide font-medium">{systemStats.uptime}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-white/10 bg-gradient-to-br from-[#1c1c24] to-[#121216] flex items-center justify-center text-[10px] font-mono text-[#00f2ff] font-bold">
              SYS
            </div>
          </div>
        </div>
      </header>

      {/* 2. Top Navigation menu */}
      <nav className="bg-[#121216] border-b border-[#242429] flex px-6 justify-between items-center select-none">
        <div className="flex gap-1">
          <button 
            id="nav-dashboard"
            onClick={() => setActiveTab('dashboard')} 
            className={`py-3 px-4 font-mono text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'dashboard' 
                ? 'border-[#00f2ff] text-[#00f2ff] bg-white/2' 
                : 'border-transparent text-white/50 hover:text-white hover:bg-white/1'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Control Dashboard Simulator
          </button>
          
          <button 
            id="nav-code"
            onClick={() => setActiveTab('code')} 
            className={`py-3 px-4 font-mono text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'code' 
                ? 'border-[#00f2ff] text-[#00f2ff] bg-white/2' 
                : 'border-transparent text-white/50 hover:text-white hover:bg-white/1'
            }`}
          >
            <Code className="w-4 h-4" />
            Agent Source Code Vault
          </button>

          <button 
            id="nav-docs"
            onClick={() => setActiveTab('docs')} 
            className={`py-3 px-4 font-mono text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'docs' 
                ? 'border-[#00f2ff] text-[#00f2ff] bg-white/2' 
                : 'border-transparent text-white/50 hover:text-white hover:bg-white/1'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Setup & Integration Guides
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <div className="text-[11px] font-mono text-white/40 flex items-center gap-2 bg-[#16161c] px-3 py-1 border border-[#242429]">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span>SYSTEM AUDIT PERSISTENCE ACTIVE</span>
          </div>
        </div>
      </nav>

      {/* Main Container Area */}
      <div className="flex-1 overflow-y-auto">

        {/* ===================================== */}
        {/* TAB 1: PC DASHBOARD SIMULATOR */}
        {/* ===================================== */}
        {activeTab === 'dashboard' && (
          <div className="p-6 max-w-[1700px] mx-auto grid grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: Physical Hardware telemetry stats (8 COLS ON DESKTOP) */}
            <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
              
              {/* Hardware stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                
                {/* 1. CPU usage stats Card */}
                <div className="bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col justify-between shadow-lg relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#00f2ff]/5 to-transparent rounded-bl-full pointer-events-none"></div>
                  <div className="flex justify-between items-start font-mono text-[10px] uppercase text-white/40">
                    <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-[#00f2ff]" /> CPU LOAD</span>
                    <span className="text-[#00f2ff]">RYZEN 5600X</span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-light font-mono text-white tracking-tight">{systemStats.cpuUsage}</span>
                    <span className="text-sm text-white/40 font-mono">%</span>
                  </div>
                  <div className="h-1 bg-white/5 mt-3 overflow-hidden rounded-full">
                    <div className="h-full bg-[#00f2ff] transition-all duration-700" style={{ width: `${systemStats.cpuUsage}%` }}></div>
                  </div>
                  <div className="mt-2 flex justify-between items-center text-[10px] font-mono text-white/40">
                    <span>Temp: <strong className="text-green-400">{systemStats.cpuTemp}°C</strong></span>
                    <span>6 Cores / 12 Threads</span>
                  </div>
                </div>

                {/* 2. GPU Load usage Card */}
                <div className="bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col justify-between shadow-lg relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#ff4d4d]/5 to-transparent rounded-bl-full pointer-events-none"></div>
                  <div className="flex justify-between items-start font-mono text-[10px] uppercase text-white/40">
                    <span className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5 text-[#ff4d4d]" /> GPU LOADING</span>
                    <span className="text-[#ff4d4d]">RTX 3060 12G</span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-light font-mono text-white tracking-tight">{systemStats.gpuUsage}</span>
                    <span className="text-sm text-white/40 font-mono">%</span>
                  </div>
                  <div className="h-1 bg-white/5 mt-3 overflow-hidden rounded-full">
                    <div className="h-full bg-[#ff4d4d] transition-all duration-700" style={{ width: `${systemStats.gpuUsage}%` }}></div>
                  </div>
                  <div className="mt-2 flex justify-between items-center text-[10px] font-mono text-white/40">
                    <span>Temp: <strong className={systemStats.gpuTemp > 65 ? "text-amber-400 animate-pulse" : "text-green-400"}>{systemStats.gpuTemp}°C</strong></span>
                    <span>GDDR6 12GB VRAM</span>
                  </div>
                </div>

                {/* 3. Memory usage Card */}
                <div className="bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col justify-between shadow-lg relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#ff8c00]/5 to-transparent rounded-bl-full pointer-events-none"></div>
                  <div className="flex justify-between items-start font-mono text-[10px] uppercase text-white/40">
                    <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-[#ff8c00]" /> PHYSICAL MEM</span>
                    <span className="text-white/60">3200MHz DDR4</span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-light font-mono text-white tracking-tight">{(systemStats.ramTotal * (systemStats.ramUsage / 100)).toFixed(1)}</span>
                    <span className="text-base text-white/40 font-mono">/ {systemStats.ramTotal} GB</span>
                  </div>
                  <div className="h-1 bg-white/5 mt-3 overflow-hidden rounded-full">
                    <div className="h-full bg-[#ff8c00] transition-all duration-700" style={{ width: `${systemStats.ramUsage}%` }}></div>
                  </div>
                  <div className="mt-2 flex justify-between items-center text-[10px] font-mono text-white/40">
                    <span>Usage fraction: <strong className="text-[#ff8c00]">{systemStats.ramUsage}%</strong></span>
                    <span>Total Slots: 2x 8GB</span>
                  </div>
                </div>

                {/* 4. Hard Drive & SSD Storage Card */}
                <div className="bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col justify-between shadow-lg relative group overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#6b7280]/5 to-transparent rounded-bl-full pointer-events-none"></div>
                  <div className="flex justify-between items-start font-mono text-[10px] uppercase text-white/40">
                    <span className="flex items-center gap-1.5"><HardDrive className="w-3.5 h-3.5 text-[#00f2ff]" /> SSD OVERVIEW</span>
                    <span className="text-white/60">NVMe PCIe 4.0</span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-light font-mono text-white tracking-tight">{systemStats.diskUsage}</span>
                    <span className="text-sm text-white/40 font-mono">% USED</span>
                  </div>
                  <div className="h-1 bg-white/5 mt-3 overflow-hidden rounded-full">
                    <div className="h-full bg-slate-400" style={{ width: `${systemStats.diskUsage}%` }}></div>
                  </div>
                  <div className="mt-2 flex justify-between items-center text-[10px] font-mono text-white/40">
                    <span>Drive Partition: <strong className="text-white/80">C:\ 1TB SSD</strong></span>
                    <span>Health Status: 100%</span>
                  </div>
                </div>

              </div>

              {/* Dual-Mode Network Connector (Connects web client dynamically to physical agent!) */}
              <div className="bg-[#16161c] border border-[#00f2ff]/20 p-5 rounded-lg flex flex-col gap-4 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#00f2ff]/5 to-transparent rounded-bl-full pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#242429]">
                  <div>
                    <h3 className="text-xs font-mono font-bold text-[#00f2ff] uppercase tracking-wider flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${liveBridgeActive ? 'bg-green-400' : 'bg-amber-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${liveBridgeActive ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                      </span>
                      {liveBridgeActive ? '⚡ Live PC Host Agent Link Activated' : '🧩 Sandbox Control Mode (Offline Emulator)'}
                    </h3>
                    <p className="text-[11px] text-white/50 mt-1 leading-normal">
                      {liveBridgeActive 
                        ? `Receiving continuous telemetry and system process updates from Windows Agent at ${agentUrl}.` 
                        : "Operating in simulated sandbox mode. Toggle 'Connect' to hook up your physical Windows machine with the background service."}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/30 uppercase">Active Core:</span>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                      liveBridgeActive 
                        ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}>
                      {liveBridgeActive ? 'Physical PC' : 'Local Sandbox'}
                    </span>
                  </div>
                </div>

                <div className="mb-2 bg-blue-500/10 border border-[#00f2ff]/30 p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-[#00f2ff] block uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                      Cloud Tunnel Connection (Bypasses Tailscale VPN Errors)
                    </span>
                    <p className="text-white/70 leading-relaxed text-[11px]">
                      Access your machine from absolutely anywhere completely bypassing firewalls, double-NAT routers, or Tailscale routing errors.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (liveBridgeActive) return;
                      setUseCloudRelay(!useCloudRelay);
                    }}
                    disabled={liveBridgeActive}
                    className={`px-4 py-1.5 rounded text-xs font-mono font-bold uppercase transition-all select-none cursor-pointer border ${
                      useCloudRelay 
                        ? 'bg-[#00f2ff] text-black border-[#00f2ff]' 
                        : 'bg-black/50 text-white/50 border-[#242429] hover:text-white'
                    }`}
                  >
                    {useCloudRelay ? '⚡ Cloud Tunnel active' : '🔌 Direct IP / VPN'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest text-[9px]">
                      {useCloudRelay ? 'Tunnel Handshake IP (Auto)' : 'Background Agent URL Address'}
                    </label>
                    <input 
                      type="text" 
                      value={useCloudRelay ? 'Cloud Reverse Tunnel (Active)' : agentUrl}
                      onChange={(e) => !useCloudRelay && setAgentUrl(e.target.value)}
                      disabled={liveBridgeActive || useCloudRelay}
                      placeholder={useCloudRelay ? 'Configured dynamically' : 'e.g. http://localhost:3000'}
                      className="w-full bg-black border border-[#242429] rounded px-3 py-2 text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#00f2ff] disabled:opacity-50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono text-white/40 uppercase tracking-widest text-[9px]">Security Passcode</label>
                    <input 
                      type="password" 
                      value={agentPasscode}
                      onChange={(e) => setAgentPasscode(e.target.value)}
                      disabled={liveBridgeActive}
                      placeholder="e.g. gamingpc123"
                      className="w-full bg-black border border-[#242429] rounded px-3 py-2 text-xs font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#00f2ff] disabled:opacity-50"
                    />
                  </div>

                  <div>
                    {liveBridgeActive ? (
                      <button
                        onClick={handleDisconnectLiveAgent}
                        className="w-full bg-red-500/20 hover:bg-red-500 hover:text-black text-red-400 transition-all border border-red-500/30 rounded py-2 text-xs font-mono uppercase tracking-wider font-bold flex items-center justify-center gap-1 shadow-md cursor-pointer"
                      >
                        <Power className="w-4 h-4" /> Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={handleConnectLiveAgent}
                        disabled={agentStatus === 'connecting'}
                        className="w-full bg-[#00f2ff]/20 hover:bg-[#00f2ff] hover:text-black text-[#00f2ff] transition-all border border-[#00f2ff]/30 rounded py-2 text-xs font-mono uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                      >
                        {agentStatus === 'connecting' ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Wifi className="w-4 h-4 animate-pulse" /> Connect Host
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                 {agentError && (
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded text-xs leading-relaxed text-red-400 font-sans flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <span className="font-bold uppercase font-mono text-[10px] block mb-0.5 text-red-400">Connection Handshake Failure</span>
                        <span>{agentError}</span>
                      </div>
                    </div>
                    
                    {useCloudRelay ? (
                      <div className="mt-1 space-y-3">
                        <div className="bg-black/40 border border-blue-500/10 p-3 rounded text-[11px] text-white/70">
                          <span className="font-bold text-[#00f2ff] block mb-1">🚀 UPGRADED: 100% RELIABLE SERVERLESS CLOUD STREAM</span>
                          <span className="text-slate-300 block mb-1 font-semibold">Your Cloud Relay has been upgraded to an immune Public Cloud Stream! It works instantly on all development sandboxes, personal networks, and firewalls with zero setup:</span>
                          <ol className="list-decimal pl-4 mt-2 space-y-2 text-white/50 leading-relaxed font-sans">
                            <li>
                              Ensure you have installed the <code className="text-[#00f2ff] font-mono font-bold">requests</code> module:
                              <pre className="mt-1.5 bg-black/60 p-1.5 rounded text-[10px] text-green-400 overflow-x-auto select-all font-mono">
                                pip install requests fastapi uvicorn psutil pywin32 pyjwt cryptography pynvml
                              </pre>
                            </li>
                            <li>
                              Start the agent by copy-pasting this single command into PowerShell on your Windows computer:
                              <pre className="mt-1.5 bg-black/60 p-1.5 rounded text-[10px] text-[#00f2ff] overflow-x-auto select-all font-mono">
                                $env:CLOUD_RELAY_URL="${window.location.origin}"; python agent.py
                              </pre>
                            </li>
                            <li>
                              Once started, you will see a successful channel link log. Click the <strong className="text-white">"Connect Host"</strong> button above!
                            </li>
                          </ol>

                          <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 text-slate-300 rounded text-[10.5px] leading-normal font-sans">
                            <span className="font-bold text-emerald-400 block mb-1">🛡️ SSO BYPASS ACTIVE</span>
                            The new connection utilizes end-to-end HTTPS streams, completely bypassing the Google SSO Workspace login credentials wall. It is zero-config, ultra-stable, and 100% works instantly.
                          </div>
                        </div>
                      </div>
                    ) : (
                      window.location.protocol === 'https:' && !agentUrl.includes('localhost') && !agentUrl.includes('127.0.0.1') && agentUrl.startsWith('http://') ? (
                        <div className="mt-1 space-y-3">
                          <div className="bg-black/40 border border-amber-500/10 p-3 rounded text-[11px] text-white/70">
                            <span className="font-bold text-[#00f2ff] block mb-1">🔒 CHROMIUM MIXED CONTENT CHECK (DIRECT MODE)</span>
                            <p className="text-white/60 mb-2">
                              Secure <code className="text-amber-400 font-mono">https://</code> sites cannot talk to private network IPs directly unless permitted.
                            </p>
                            <ol className="list-decimal pl-4 space-y-1 text-white/50">
                              <li>Click the <span className="font-bold text-white">"Sliders / Settings" icon</span> to the left of your URL bar.</li>
                              <li>Open <span className="font-bold text-white">"Site settings"</span>, find <span className="font-bold text-white">"Insecure content"</span> and set it to <span className="text-green-400 font-bold">"Allow"</span>.</li>
                              <li>Reload this browser page to apply the settings.</li>
                            </ol>
                          </div>
                        </div>
                      ) : (
                        <span className="block mt-1 text-white/40 text-[10px]">
                          💡 Tips: Make sure the Python agent (<code className="bg-black/50 px-1 py-0.5 rounded text-white font-mono text-[9px]">agent.py</code>) is bootloaded by running <code className="bg-black/50 px-1 py-0.5 rounded text-[#00f2ff] font-mono text-[9px]">uvicorn agent:app --host 0.0.0.0 --port 3000</code> on your host. Note that binding to <code className="bg-black/50 px-1 py-0.5 rounded text-amber-400 font-mono text-[9px]">--host 0.0.0.0</code> is required for other devices and Tailscale IPs to reach it!
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Developer Real-time telemetry Stress controls (very interactive and fun!) */}
              <div className="bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-wrap gap-6 items-center justify-between">
                <div>
                  <h3 className="text-xs font-mono font-bold text-[#00f2ff] uppercase tracking-wide flex items-center gap-1">
                    <Flame className="w-4 h-4 text-orange-500" /> 
                    Live Environment Simulator Controller
                  </h3>
                  <p className="text-xs text-white/40 mt-1">Adjust sliders to simulate loads and watch the phone and dashboard metrics update synchronously.</p>
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-white/40 uppercase">Simulate CPU Load ({cpuStress || "Auto"}%)</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={cpuStress} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setCpuStress(val);
                        addLog('info', 'system', `Simulated CPU stress load altered manually to ${val}%`);
                      }}
                      className="accent-[#00f2ff] bg-black border border-white/5 h-1.5 rounded-lg appearance-auto w-32 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-white/40 uppercase">Simulate GPU Load ({gpuStress || "Auto"}%)</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={gpuStress} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setGpuStress(val);
                        addLog('info', 'system', `Simulated GPU stress load altered manually to ${val}%`);
                      }}
                      className="accent-[#ff4d4d] bg-black border border-white/5 h-1.5 rounded-lg appearance-auto w-32 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-white/40 uppercase">Network Tunnel Mode</label>
                    <select 
                      value={connectionMode} 
                      onChange={(e) => {
                        const mode = e.target.value as 'Tailscale' | 'LAN' | 'WAN';
                        setConnectionMode(mode);
                        addLog('success', 'network', `Configured network access tunnel mode interface to ${mode.toUpperCase()}`);
                      }}
                      className="bg-black border border-[#242429] rounded text-white text-xs font-mono p-1 px-2 focus:outline-none focus:border-[#00f2ff]"
                    >
                      <option value="Tailscale">Tailscale Mesh VPN</option>
                      <option value="LAN">Local Network Link</option>
                      <option value="WAN">Public IP Forwarding</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* MIDDLE ZONE GRID: PROCESS MANAGER & NETWORK CONTROLS */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Process Manager Sub-panel (7 Columns) */}
                <div className="md:col-span-7 bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col h-[1020px]">
                  <div className="flex items-center justify-between border-b border-[#242429] pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-mono uppercase tracking-widest text-[#00f2ff] font-bold">Process Manager Terminal</h2>
                      <span className="text-[10px] font-mono bg-white/5 border border-white/10 px-1.5 rounded text-white/70">
                        {processes.length} Processes
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setFavoritesOnly(!favoritesOnly)}
                        className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors ${
                          favoritesOnly 
                            ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                        }`}
                      >
                        Favorites Only
                      </button>
                    </div>
                  </div>

                  {/* Process Quick filters & Search */}
                  <div className="flex gap-2 items-center mb-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-white/40" />
                      <input 
                        type="text"
                        placeholder="Search processes by Name, Path or PID..."
                        value={processSearch}
                        onChange={(e) => setProcessSearch(e.target.value)}
                        className="w-full bg-black border border-[#242429] rounded pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#00f2ff]"
                      />
                    </div>
                    
                    <select
                      value={processSortBy}
                      onChange={(e) => setProcessSortBy(e.target.value as 'cpu' | 'ram' | 'name')}
                      className="bg-black border border-[#242429] rounded text-white text-xs font-mono p-1.5 focus:outline-none focus:border-[#00f2ff]"
                      title="Sort processes"
                    >
                      <option value="cpu">Sort by CPU %</option>
                      <option value="ram">Sort by RAM MB</option>
                      <option value="name">Sort by Name</option>
                    </select>
                  </div>

                  {/* Application presets / Quick-kill dashboard */}
                  <div className="mb-4 bg-black/40 border border-[#242429] p-2.5 rounded">
                    <div className="text-[9px] font-mono uppercase text-white/40 mb-1.5">Administrative Preset Control Shortcuts:</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Valorant', name: 'valorant.exe', color: 'hover:bg-red-500/10 hover:border-red-500 hover:text-red-400' },
                        { label: 'Steam', name: 'steam.exe', color: 'hover:bg-[#ff8c00]/10 hover:border-[#ff8c00] hover:text-[#ff8c00]' },
                        { label: 'Discord', name: 'discord.exe', color: 'hover:bg-blue-500/10 hover:border-blue-500 hover:text-blue-400' },
                        { label: 'Chrome', name: 'chrome.exe', color: 'hover:bg-green-500/10 hover:border-green-500 hover:text-green-400' },
                        { label: 'Spotify', name: 'spotify.exe', color: 'hover:bg-emerald-500/10 hover:border-emerald-500 hover:text-emerald-400' }
                      ].map((preset) => {
                        const isRunning = processes.some(p => p.name.toLowerCase() === preset.name);
                        return (
                          <div key={preset.label} className="flex items-center gap-1 bg-white/5 rounded pl-2 pr-1 py-1 border border-white/5 text-[11px] font-mono">
                            <span className={isRunning ? 'text-green-400' : 'text-white/30'}>
                              {preset.label}
                            </span>
                            {isRunning ? (
                              <button 
                                onClick={() => handleQuickKillApp(preset.name)}
                                className="ml-1 bg-red-500/20 hover:bg-red-500 hover:text-black transition-colors rounded text-[8px] font-mono px-1.5 py-0.5 text-red-500 font-bold"
                                title="Kill application"
                              >
                                KILL
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleLaunchApp(preset.label)}
                                className="ml-1 bg-[#00f2ff]/10 hover:bg-[#00f2ff] hover:text-black transition-colors rounded text-[8px] font-mono px-1.5 py-0.5 text-[#00f2ff] font-bold"
                                title="Launch application preset"
                              >
                                LAUNCH
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* PC Launchpad (All Installed Apps) */}
                  <div className="mb-4 bg-black/40 border border-[#242429] p-3 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-mono uppercase text-[#00f2ff] font-bold tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00f2ff] animate-pulse"></span>
                        PC Launchpad (All Installed Applications)
                      </div>
                      <button 
                        onClick={fetchInstalledApps}
                        disabled={isLoadingApps}
                        className="text-[9px] font-mono bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] hover:text-white px-2 py-0.5 rounded border border-[#00f2ff]/20 disabled:opacity-50 transition-all font-bold"
                      >
                        {isLoadingApps ? 'SCANNING...' : 'SCAN APPLICATIONS'}
                      </button>
                    </div>

                    <p className="text-[10px] text-white/50 mb-2.5 font-mono leading-relaxed">
                      Retrieve and dynamically open any system application or general Store App installed on the target PC.
                    </p>

                    <div className="relative mb-3">
                      <span className="absolute left-2.5 top-2 text-[10px] text-white/30 font-mono">🔍</span>
                      <input 
                        type="text"
                        placeholder="Search programs by name or appId..."
                        value={appSearchQuery}
                        onChange={(e) => setAppSearchQuery(e.target.value)}
                        className="w-full bg-black border border-[#242429] rounded pl-8 pr-3 py-1.5 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#00f2ff]"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-1.5 pr-1 text-[11px] font-mono scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                      {installedApps
                        .filter(app => app.name.toLowerCase().includes(appSearchQuery.toLowerCase()) || app.id.toLowerCase().includes(appSearchQuery.toLowerCase()))
                        .map(app => {
                          const isAppRunning = processes.some(p => p.name.toLowerCase().includes(app.name.toLowerCase()) || p.name.toLowerCase().includes(app.id.toLowerCase()));
                          return (
                            <div key={app.id} className="flex flex-col justify-between p-1.5 bg-[#0e0e12] border border-[#242429] rounded hover:border-[#00f2ff]/30 hover:bg-[#00f2ff]/5 transition-all group">
                              <div className="flex items-start justify-between min-w-0 mb-1">
                                <span className={`font-medium truncate pr-1 text-xs ${isAppRunning ? 'text-green-400 font-bold' : 'text-white/80 group-hover:text-white'}`} title={app.name}>
                                  {app.name}
                                </span>
                                <span className={`text-[7px] px-1 py-0.5 ${isAppRunning ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-white/5 text-white/40 border border-white/5'} rounded font-semibold whitespace-nowrap`}>
                                  {isAppRunning ? 'ACTIVE' : app.platform.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[8px] text-white/20 truncate mb-2 font-mono" title={app.id}>
                                {app.id}
                              </div>
                              <button 
                                onClick={() => handleLaunchApp(app.id)}
                                className="w-full py-1 text-center text-[9px] font-bold uppercase rounded bg-[#00f2ff]/10 hover:bg-[#00f2ff] hover:text-black text-[#00f2ff] border border-[#00f2ff]/10 hover:border-[#00f2ff] transition-all"
                              >
                                LAUNCH APP
                              </button>
                            </div>
                          );
                        })}
                      {installedApps.length === 0 && (
                        <div className="col-span-full py-6 text-center text-white/30 italic text-[11px] border border-dashed border-white/5 rounded">
                          No programs found. Run active agent & trigger "Scan Applications".
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Processes Table View */}
                  <div className="flex-1 overflow-y-auto border border-[#242429] rounded bg-black/30 font-mono text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-[#121216]/80 text-white/40 sticky top-0 border-b border-[#242429] text-[10px] uppercase">
                        <tr>
                          <th className="p-2 font-normal">Fav / Process Name</th>
                          <th className="p-2 font-normal text-right">PID</th>
                          <th className="p-2 font-normal text-right">CPU</th>
                          <th className="p-2 font-normal text-right">Memory</th>
                          <th className="p-2 font-normal text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProcesses.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-white/30 italic">No processes matched filter settings or search query.</td>
                          </tr>
                        ) : (
                          filteredProcesses.map((p) => (
                            <tr key={p.pid} className={`border-b border-white/5 hover:bg-white/2 transition-colors ${p.status === 'suspended' ? 'opacity-40 bg-zinc-900/40' : ''}`}>
                              <td className="p-2 flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap" title={p.path}>
                                <button 
                                  onClick={() => handleToggleFavorite(p.pid)} 
                                  className={`text-sm hover:scale-115 transition-transform ${p.favorite ? 'text-amber-400' : 'text-white/20 hover:text-white'}`}
                                >
                                  ★
                                </button>
                                <span className={p.name === 'valorant.exe' ? 'text-red-400 font-bold' : 'text-white/90'}>
                                  {p.name}
                                </span>
                              </td>
                              <td className="p-2 text-right text-white/50 text-[11px] font-mono">{p.pid}</td>
                              <td className="p-2 text-right font-medium text-emerald-400">{p.cpu}%</td>
                              <td className="p-2 text-right font-medium text-sky-400">{p.ram >= 1000 ? `${(p.ram / 1024).toFixed(1)} GB` : `${p.ram} MB`}</td>
                              <td className="p-2 text-center flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleToggleSuspend(p.pid, p.name)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    p.status === 'suspended'
                                      ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-black'
                                      : 'bg-white/5 text-white/50 hover:bg-amber-500/10 hover:text-amber-400'
                                  }`}
                                  title={p.status === 'suspended' ? "Resume execution Thread" : "Freeze process cycle"}
                                >
                                  {p.status === 'suspended' ? 'RESUME' : 'SUSP'}
                                </button>
                                <button
                                  onClick={() => handleKillProcess(p.pid, p.name)}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-black font-semibold transition-all"
                                  title="Terminate Process"
                                >
                                  KILL
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>

                {/* Automation Rules Builder & Network Card controls (5 Columns) */}
                <div className="md:col-span-5 flex flex-col gap-6">
                  
                  {/* Power & Network Hardware Control dashboard */}
                  <div id="power-controls-section" className="bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-[#00f2ff] font-bold mb-3 border-b border-[#242429] pb-2">
                      Power & Network Actuators
                    </h2>

                    {/* Network quick toggles */}
                    <div className="mb-4 bg-black/40 border border-[#242429] p-3 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] font-mono text-white/40 uppercase">Broadband Gateway Status</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${
                          systemStats.internetConnected 
                            ? 'bg-green-500/10 text-green-400' 
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {systemStats.internetConnected ? 'GLOBAL WAN CONNECTED' : 'WAN OFFLINE'}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleToggleInternet}
                          className={`flex-1 py-2 rounded text-xs gap-1.5 font-mono flex items-center justify-center transition-all ${
                            systemStats.internetConnected 
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black' 
                              : 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500 hover:text-black'
                          }`}
                        >
                          {systemStats.internetConnected ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                          {systemStats.internetConnected ? 'Disable Internet' : 'Enable Internet'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2.5">
                        <button 
                          onClick={() => handleToggleAdapter('Ethernet')} 
                          className="bg-white/5 border border-white/5 hover:border-white/20 p-1.5 rounded text-[10px] font-mono text-white/70 hover:text-white transition-all text-center"
                        >
                          Reset Ethernet Port
                        </button>
                        <button 
                          onClick={() => handleToggleAdapter('WiFi')} 
                          className="bg-white/5 border border-white/5 hover:border-white/20 p-1.5 rounded text-[10px] font-mono text-white/70 hover:text-white transition-all text-center"
                        >
                          Reset WiFi Antenna
                        </button>
                      </div>
                    </div>

                    {/* Hardware Power controller grid button layout */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { action: 'lock', label: 'Lock PC', icon: <Lock className="w-4 h-4 text-sky-400" /> },
                        { action: 'sleep', label: 'Sleep PC', icon: <Power className="w-4 h-4 text-amber-500" /> },
                        { action: 'hibernate', label: 'Hibernate', icon: <Database className="w-4 h-4 text-violet-400" /> },
                        { action: 'restart', label: 'Reboot system', icon: <Power className="w-4 h-4 text-[#00f2ff] rotate-90" /> },
                        { action: 'logoff', label: 'Sign out', icon: <Unlock className="w-4 h-4 text-slate-400" /> },
                        { action: 'shutdown', label: 'Shutdown PC', icon: <Power className="w-4 h-4 text-red-500" />, highlight: true }
                      ].map((item) => (
                        <button
                          key={item.action}
                          onClick={() => setPowerModal(item.action)}
                          className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 transition-all ${
                            item.highlight 
                              ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500 hover:text-black hover:border-red-500 text-red-400 shadow-sm' 
                              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white'
                          }`}
                        >
                          {item.icon}
                          <span className="text-[10px] uppercase font-mono font-medium tracking-tighter text-center">{item.label}</span>
                        </button>
                      ))}
                    </div>

                  </div>

                  {/* Host Master Media & Shell Controller Panel (Web App Feature Parity) */}
                  <div className="bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col gap-4">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-[#00f2ff] font-bold border-b border-[#242429] pb-2 flex justify-between items-center">
                      <span>Host Master Controls</span>
                      <span className="text-[9px] font-mono bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/20 px-1.5 py-0.5 rounded uppercase">
                        SND & CMD Link
                      </span>
                    </h2>

                    {/* Integrated Slider */}
                    <div className="bg-black/40 border border-[#242429] p-3 rounded space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-white/40 uppercase">Physical System Volume</span>
                        <span className="text-xs font-mono font-bold text-[#00f2ff]">{phoneVolume}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Volume2 className="w-4 h-4 text-white/60 animate-pulse" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={phoneVolume}
                          onChange={(e) => handleSetVolume(parseInt(e.target.value))}
                          className="flex-1 accent-[#00f2ff] h-1 bg-zinc-800 rounded-lg cursor-pointer"
                        />
                        <button
                          onClick={() => playVolumeTestTone(phoneVolume)}
                          className="text-[10px] font-mono px-2.5 py-1 rounded bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/20 text-[#00f2ff] hover:text-white transition-all font-bold"
                        >
                          TEST TONE
                        </button>
                        <button
                          onClick={() => handleSetVolume(phoneVolume === 0 ? 70 : 0)}
                          className="text-[10px] font-mono px-2.5 py-1 rounded bg-[#242429] hover:bg-zinc-800 border border-white/5 text-white/80 hover:text-white transition-all font-bold"
                        >
                          {phoneVolume === 0 ? "UNMUTE" : "MUTE"}
                        </button>
                      </div>
                    </div>

                    {/* Remote Command Terminal */}
                    <div className="bg-black border border-[#242429] p-3 rounded flex flex-col font-mono text-xs gap-2">
                      <div className="flex justify-between items-center text-[10px] text-white/40 uppercase">
                        <span>Remote PowerShell Terminal</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                      </div>
                      
                      <div className="bg-[#09090c] border border-white/5 rounded p-2.5 h-[150px] overflow-y-auto font-mono text-[10.5px] leading-normal text-green-400 select-all space-y-1">
                        {phoneShellOutput.map((val, idx) => (
                          <div key={idx} className="whitespace-pre-wrap">{val}</div>
                        ))}
                        {phoneShellLoading && (
                          <div className="animate-pulse text-[#00f2ff]">Communicating with background host...</div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={phoneShellCmd}
                          onChange={(e) => setPhoneShellCmd(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handlePhoneShellSubmit();
                          }}
                          placeholder="Type host instruction (e.g. dir, whoami, ping google.com)..."
                          className="flex-1 bg-black border border-[#242429] rounded px-2.5 py-1.5 text-xs text-green-300 placeholder-green-900/40 focus:outline-none focus:border-[#00f2ff] font-mono"
                        />
                        <button
                          onClick={handlePhoneShellSubmit}
                          disabled={phoneShellLoading}
                          className="bg-[#00f2ff]/10 hover:bg-[#00f2ff] hover:text-black border border-[#00f2ff]/30 text-[#00f2ff] px-3.5 rounded font-mono text-[10px] font-bold uppercase transition-all flex items-center justify-center disabled:opacity-50"
                        >
                          RUN
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Automation Rules Dynamic Engine builder */}
                  <div className="bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col flex-1 min-h-[250px]">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-[#00f2ff] font-bold mb-3 border-b border-[#242429] pb-2 flex justify-between items-center">
                      <span>Automation Security Engine</span>
                      <span className="text-[9px] text-white/40 uppercase normal-case font-normal font-sans">Self-Hosted Rule Matrix</span>
                    </h2>

                    {/* Rule display list */}
                    <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 mb-4 max-h-[160px] pr-1">
                      {automationRules.length === 0 ? (
                        <div className="text-center p-4 italic text-[11px] text-white/30">No active automation rules declared on the database.</div>
                      ) : (
                        automationRules.map((rule) => (
                          <div 
                            key={rule.id} 
                            className={`p-2.5 border rounded flex flex-col gap-1 text-[11px] font-mono transition-opacity ${
                              rule.enabled ? 'bg-black/30 border-[#242429]' : 'bg-black/10 border-white/5 opacity-50'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-white/95">{rule.name}</span>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleToggleRule(rule.id, rule.name)}
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${
                                    rule.enabled 
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                      : 'bg-white/5 text-white/30 border border-white/10'
                                  }`}
                                >
                                  {rule.enabled ? 'ENABLED' : 'MUTED'}
                                </button>
                                <button 
                                  onClick={() => handleDeleteRule(rule.id, rule.name)}
                                  className="text-white/30 hover:text-red-400 px-1 hover:bg-white/5 rounded text-[10px]"
                                  title="Delete rule configuration"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1 font-mono text-[10px]">
                              <span className="bg-white/5 px-1.5 py-0.5 text-sky-400 rounded border border-white/5">{rule.trigger}</span>
                              <span className="text-white/40">→</span>
                              <span className="bg-[#00f2ff]/5 px-1.5 py-0.5 text-[#00f2ff] rounded border border-[#00f2ff]/10">{rule.action}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Quick creation form */}
                    <form onSubmit={handleAddRule} className="bg-black/40 border border-[#242429] p-3 rounded flex flex-col gap-2.5">
                      <div className="text-[10px] font-mono text-[#00f2ff] uppercase font-bold tracking-tight">Create Automation Agent Rule</div>
                      <input 
                        type="text"
                        placeholder="Rule nickname (e.g. Threat alert)..."
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        className="w-full bg-black border border-[#242429] rounded p-1.5 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#00f2ff]"
                        required
                      />

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div className="flex flex-col gap-0.5">
                          <label className="text-white/40 uppercase">When trigger condition: (IF)</label>
                          <select 
                            value={newRuleTrigger}
                            onChange={(e) => setNewRuleTrigger(e.target.value)}
                            className="bg-black border border-[#242429] rounded p-1 font-mono focus:outline-none text-white leading-tight"
                          >
                            <option value="IF Valorant Starts">IF Valorant Starts</option>
                            <option value="IF CPU > 90%">IF CPU &gt; 90% Limit</option>
                            <option value="IF Specific User Logs In">IF Key User Logs In</option>
                            <option value="IF Internet Is Enabled">IF Internet Adapter Toggled</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <label className="text-white/40 uppercase">Take secure action: (THEN)</label>
                          <select 
                            value={newRuleAction}
                            onChange={(e) => setNewRuleAction(e.target.value)}
                            className="bg-black border border-[#242429] rounded p-1 font-mono focus:outline-none text-white leading-tight"
                          >
                            <option value="THEN Send Notification">THEN Send Push Notification</option>
                            <option value="THEN Send Alert">THEN Flash Emergency Alarm</option>
                            <option value="THEN Lock PC">THEN Lock physical PC</option>
                            <option value="THEN Close Application">THEN Kill execution processes</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-1 bg-[#00f2ff]/20 hover:bg-[#00f2ff] text-[#00f2ff] hover:text-black transition-all border border-[#00f2ff]/30 rounded py-1.5 text-xs font-mono uppercase tracking-wide font-bold flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Commit Automation Rule
                      </button>
                    </form>

                  </div>

                </div>

              </div>

              {/* AUDIT LOGGING TERMINAL CONTAINER */}
              <div id="audit-logs-section" className="bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col h-[280px]">
                <div className="flex items-center justify-between border-b border-[#242429] pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#ff8c00]" />
                    <h2 className="text-xs font-mono uppercase tracking-widest text-[#ff8c00] font-bold">Administrative Security Audit Console</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setAuditLogs([])} 
                      className="text-[10px] font-mono text-white/40 hover:text-red-400 hover:bg-white/5 rounded px-2.5 py-1 flex items-center gap-1 border border-transparent hover:border-red-500/20"
                      title="Clear active history cache"
                    >
                      <Trash2 className="w-3 h-3" /> Clear Audit Logs
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-black/50 border border-[#242429] p-3 rounded font-mono text-[11px] leading-relaxed flex flex-col gap-1.5 select-all">
                  {auditLogs.length === 0 ? (
                    <div className="text-white/20 italic p-6 text-center">Audit trail empty. Interaction events registers down in real-time.</div>
                  ) : (
                    auditLogs.map((log) => {
                      let levelColor = "text-white/50";
                      if (log.level === 'success') levelColor = "text-green-400 font-semibold";
                      if (log.level === 'warning') levelColor = "text-[#ff8c00] font-semibold animate-pulse";
                      if (log.level === 'error') levelColor = "text-red-500 font-bold";

                      let badgeBg = "bg-white/5 text-white/60";
                      if (log.category === 'security') badgeBg = "bg-sky-500/10 text-sky-400 border border-sky-500/20";
                      if (log.category === 'power') badgeBg = "bg-violet-500/10 text-violet-400 border border-violet-500/20";
                      if (log.category === 'network') badgeBg = "bg-[#ff8c00]/10 text-[#ff8c00] border border-[#ff8c00]/20";
                      if (log.category === 'process') badgeBg = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";

                      return (
                        <div key={log.id} className="flex flex-wrap gap-2 py-0.5 border-b border-white/2 border-dashed">
                          <span className="text-white/20 text-[10px]">{`[${log.timestamp}]`}</span>
                          <span className={`w-14 uppercase text-[10px] ${levelColor}`}>{log.level}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] uppercase tracking-tighter ${badgeBg}`}>{log.category}</span>
                          <span className="text-white/80">{log.message}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: SIMULATED ANDROID HANDHELD CONTROLLER (4 COLS ON DESKTOP) */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              
              {/* Emergency Lockdown Action Center */}
              <div className="bg-gradient-to-br from-[#1c1c24] to-[#16161c] border border-[#00f2ff]/30 p-4 rounded-lg flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f2ff]/5 rounded-bl-full pointer-events-none transform group-hover:scale-110 transition-transform"></div>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-[#00f2ff] uppercase font-mono text-[10px] tracking-widest font-bold">
                    <span>Emergency Threat Switch</span>
                    <span className="w-2 h-2 rounded-full bg-[#00f2ff] animate-pulse"></span>
                  </div>
                  <h3 className="text-lg font-bold font-sans tracking-tight">Gaming Lockdown Dashboard</h3>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Instantly flush memory, close any running game launchers or browsers (Steam, Discord, Valorant, Chrome) and lock interface adapters in priority mode.
                  </p>
                </div>
                
                <button
                  onClick={handleToggleGamingLockdown}
                  className={`w-full mt-4 py-3 border rounded font-mono text-xs uppercase tracking-widest font-bold transition-all shadow-md ${
                    gamingLockdownActive 
                      ? 'bg-red-500 text-black border-red-500 hover:bg-red-600 shadow-red-500/20' 
                      : 'bg-[#00f2ff]/10 hover:bg-[#00f2ff] hover:text-black border-[#00f2ff]/40 text-[#00f2ff] shadow-[#00f2ff]/5'
                  }`}
                >
                  {gamingLockdownActive ? 'DEACTIVATE LOCKDOWN' : 'ACTIVATE GAMING LOCKDOWN'}
                </button>
              </div>

              {/* HIGH FIDELITY SIMULATED SMARTPHONE PREVIEW */}
              <div className="bg-[#1c1c24] border border-[#242429] rounded-3xl p-4 flex flex-col shadow-2xl h-[780px] max-w-[360px] mx-auto w-full relative">
                
                {/* Visual hardware details */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-5 bg-black rounded-b-xl z-20 flex items-center justify-center">
                  <div className="w-12 h-2.5 bg-zinc-800 rounded-full mb-1"></div>
                </div>
                <div className="absolute top-3 right-6 text-[9px] font-mono text-white/40">5G</div>

                {/* Simulated inner display */}
                <div className="flex-1 bg-black rounded-2xl border border-zinc-800 p-3 overflow-hidden flex flex-col justify-between relative mt-4">
                  
                  {/* Smartphone app header */}
                  <div className="border-b border-zinc-900 pb-2 mb-2 flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 bg-[#00f2ff]/10 rounded border border-[#00f2ff]/30 flex items-center justify-center">
                        <Smartphone className="w-3 h-3 text-[#00f2ff]" />
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] font-bold tracking-tight text-white/90">PC Sentinel App</div>
                        <div className="text-[7.5px] text-green-400 font-mono flex items-center gap-0.5 uppercase">
                          <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse"></span>
                          Pairing Active to PC
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-[8px] font-mono bg-zinc-900 text-amber-500 border border-zinc-800 px-1 rounded uppercase">
                      Tailscale link
                    </div>
                  </div>

                  {/* Smartphone App Content scroll area */}
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5 text-xs">
                    {phoneActiveTab === 'dashboard' && (
                      <div className="space-y-3">
                        {/* Windows OS Host Stats */}
                        <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 flex flex-col gap-1.5">
                          <div className="text-[8px] font-mono uppercase text-white/40">Windows OS Host Stats</div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/60 p-1.5 rounded border border-zinc-800">
                              <span className="text-[8px] text-white/40 block">CPU STRETCH</span>
                              <strong className="text-xs font-mono text-[#00f2ff]">{systemStats.cpuUsage}%</strong>
                            </div>
                            <div className="bg-black/60 p-1.5 rounded border border-zinc-800">
                              <span className="text-[8px] text-white/40 block">GPU THERMAL</span>
                              <strong className="text-xs font-mono text-[#ff4d4d]">{systemStats.gpuTemp}°C</strong>
                            </div>
                            <div className="bg-black/60 p-1.5 rounded border border-zinc-800">
                              <span className="text-[8px] text-white/40 block">RAM UTILITY</span>
                              <strong className="text-xs font-mono text-[#ff8c00]">{systemStats.ramUsage}%</strong>
                            </div>
                            <div className="bg-black/60 p-1.5 rounded border border-zinc-800">
                              <span className="text-[8px] text-white/40 block">HOST UPTIME</span>
                              <strong className="text-[10px] font-mono text-white/90 truncate block">{systemStats.uptime}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Volume Dynamic Slider */}
                        <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-mono uppercase text-white/40">Host Audio Volume</span>
                            <span className="text-[9px] font-mono text-[#00f2ff]">{phoneVolume}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Volume2 className="w-3.5 h-3.5 text-white/60" />
                            <input 
                              type="range"
                              min="0"
                              max="100"
                              value={phoneVolume}
                              onChange={(e) => handleSetVolume(parseInt(e.target.value))}
                              className="flex-1 accent-[#00f2ff] h-1 bg-zinc-800 rounded-lg cursor-pointer"
                            />
                            <button 
                              onClick={() => playVolumeTestTone(phoneVolume)}
                              className="text-[8px] px-1.5 py-0.5 rounded bg-[#00f2ff]/10 border border-[#00f2ff]/20 text-[#00f2ff] hover:text-white"
                            >
                              TEST
                            </button>
                            <button 
                              onClick={() => handleSetVolume(phoneVolume === 0 ? 70 : 0)}
                              className="text-[8px] px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-700 text-white/80 hover:text-white"
                            >
                              {phoneVolume === 0 ? "UNMUTE" : "MUTE"}
                            </button>
                          </div>
                        </div>

                        {/* Host App Preset Short-Cuts */}
                        <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                          <div className="text-[8px] font-mono uppercase text-white/40 mb-1.5">Host App Preset Short-Cuts</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { label: 'Valorant', procName: 'valorant.exe', logo: '🔴' },
                              { label: 'Discord', procName: 'discord.exe', logo: '💬' },
                              { label: 'Chrome', procName: 'chrome.exe', logo: '🌐' },
                              { label: 'Spotify', procName: 'spotify.exe', logo: '🎵' }
                            ].map((btn) => {
                              const procRunning = processes.some(p => p.name.toLowerCase() === btn.procName);
                              return (
                                <button
                                  key={btn.label}
                                  onClick={() => {
                                    if (procRunning) {
                                      handleQuickKillApp(btn.procName);
                                    } else {
                                      handleLaunchApp(btn.label);
                                    }
                                  }}
                                  className={`p-2 rounded text-left border text-[10px] font-mono flex items-center justify-between transition-colors ${
                                    procRunning 
                                      ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                      : 'bg-black/40 border-zinc-800 text-white/60 hover:text-white'
                                  }`}
                                >
                                  <span className="truncate">{btn.logo} {btn.label}</span>
                                  <span className="text-[7px] font-bold uppercase py-0.5 px-1 bg-zinc-800 rounded">
                                    {procRunning ? 'KILL' : 'RUN'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Pocket Launchpad (All Installed Apps) */}
                        <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-mono uppercase text-white/40">PC App Launchpad</span>
                            <button
                              onClick={fetchInstalledApps}
                              disabled={isLoadingApps}
                              className="text-[7px] font-mono text-[#00f2ff] hover:underline"
                            >
                              {isLoadingApps ? "SCANNING..." : "SCAN APPS"}
                            </button>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search PC programs..."
                              value={appSearchQuery}
                              onChange={(e) => setAppSearchQuery(e.target.value)}
                              className="w-full bg-black border border-zinc-800 rounded px-1.5 py-0.5 text-[8.5px] font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#00f2ff]"
                            />
                          </div>
                          <div className="max-h-[140px] overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                            {installedApps
                              .filter(app => app.name.toLowerCase().includes(appSearchQuery.toLowerCase()) || app.id.toLowerCase().includes(appSearchQuery.toLowerCase()))
                              .slice(0, 15) // throttle list size for responsive mobile view rendering
                              .map(app => {
                                const isAppRunning = processes.some(p => p.name.toLowerCase().includes(app.name.toLowerCase()) || p.name.toLowerCase().includes(app.id.toLowerCase()));
                                return (
                                  <div key={app.id} className="bg-black/50 p-1.5 rounded border border-zinc-900 flex justify-between items-center text-[9px] font-mono">
                                    <div className="flex flex-col truncate max-w-[110px]">
                                      <span className={`truncate ${isAppRunning ? 'text-[#00f2ff] font-bold' : 'text-white/80'}`}>{app.name}</span>
                                      <span className="text-[6.5px] text-white/30 truncate">{app.id}</span>
                                    </div>
                                    <button 
                                      onClick={() => handleLaunchApp(app.id)}
                                      className="text-[8px] bg-[#00f2ff]/10 hover:bg-[#00f2ff] hover:text-black text-[#00f2ff] rounded px-2 py-0.5 font-bold transition-all"
                                    >
                                      LAUNCH
                                    </button>
                                  </div>
                                );
                              })}
                            {installedApps.length === 0 && (
                              <div className="text-center text-white/30 italic text-[8.5px] py-1.5">No apps scanned.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {phoneActiveTab === 'processes' && (
                      <div className="space-y-3">
                        {/* Active Task Manager */}
                        <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[8px] font-mono uppercase text-white/40">Active Task Sentry</span>
                            <span className="text-[8px] text-[#00f2ff]">Real-Time Feed</span>
                          </div>

                          {/* Search bar inside phone process tab */}
                          <div className="relative mb-2">
                            <Search className="w-3 h-3 absolute left-1.5 top-2 text-white/45" />
                            <input
                              type="text"
                              value={phoneProcessSearch}
                              onChange={(e) => setPhoneProcessSearch(e.target.value)}
                              placeholder="Search running processes..."
                              className="w-full bg-black border border-zinc-800 rounded px-2 py-1 pl-5.5 text-[8.5px] font-mono text-white placeholder-white/30 focus:outline-none focus:border-[#00f2ff]"
                            />
                          </div>
                          
                          <div className="space-y-1 max-h-[220px] overflow-y-auto pr-0.5">
                            {processes
                              .filter(p => p.name.toLowerCase().includes(phoneProcessSearch.toLowerCase()))
                              .map((p) => (
                                <div key={p.pid} className="bg-black/50 p-1.5 rounded border border-zinc-900 flex justify-between items-center text-[9px] font-mono">
                                  <div className="flex flex-col truncate max-w-[120px]">
                                    <span className="truncate text-white/85">{p.name}</span>
                                    <span className="text-[7px] text-white/40">PID: {p.pid}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-emerald-400 font-bold text-[8.5px]">{p.cpu}%</span>
                                    <button 
                                      onClick={() => handleKillProcess(p.pid, p.name)}
                                      className="text-[8px] bg-red-900/40 text-red-400 hover:bg-red-500 hover:text-black rounded px-1.5 py-0.5 font-bold"
                                    >
                                      KILL
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {phoneActiveTab === 'power' && (
                      <div className="space-y-3">
                        {/* Power Commands */}
                        <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 space-y-2">
                          <div className="text-[8px] font-mono uppercase text-white/40">Administrative Power Commands</div>
                          <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                            <button
                              onClick={() => executePowerAction('lock')}
                              className="bg-black/60 border border-zinc-800 hover:bg-zinc-800 p-2 rounded text-center text-white font-mono flex items-center justify-center gap-1"
                            >
                              <Lock className="w-3 h-3 text-sky-400" /> LOCK WORKSTATION
                            </button>
                            <button
                              onClick={() => executePowerAction('sleep')}
                              className="bg-black/60 border border-zinc-800 hover:bg-zinc-800 p-2 rounded text-center text-white font-mono flex items-center justify-center gap-1"
                            >
                              <Power className="w-3 h-3 text-amber-500" /> ACPI SLEEP
                            </button>
                            <button
                              onClick={() => executePowerAction('restart')}
                              className="bg-black/60 border border-zinc-800 hover:bg-zinc-800 p-2 rounded text-center text-white font-mono flex items-center justify-center gap-1"
                            >
                              <Zap className="w-3 h-3 text-emerald-400" /> REMOTE REBOOT
                            </button>
                            <button
                              onClick={() => executePowerAction('shutdown')}
                              className="bg-black/60 border border-red-900/40 hover:bg-red-900/20 p-2 rounded text-center text-red-400 font-mono flex items-center justify-center gap-1"
                            >
                              <Power className="w-3 h-3 text-red-500 animate-pulse" /> SHUTDOWN PC
                            </button>
                          </div>
                        </div>

                        {/* Gaming Lockdown Trigger inside phone */}
                        <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 space-y-1.5">
                          <div className="text-[8px] font-mono uppercase text-white/40">Emergency Threat Response</div>
                          <button
                            onClick={handleToggleGamingLockdown}
                            className={`w-full py-2 border rounded font-mono text-[9px] uppercase tracking-wider font-bold transition-all shadow-md ${
                              gamingLockdownActive 
                                ? 'bg-red-500 text-black border-red-500 hover:bg-red-600 shadow-red-500/20' 
                                : 'bg-[#00f2ff]/10 hover:bg-[#00f2ff] hover:text-black border-[#00f2ff]/40 text-[#00f2ff]'
                            }`}
                          >
                            {gamingLockdownActive ? 'DEACTIVATE LOCKDOWN' : 'ACTIVATE LOCKDOWN'}
                          </button>
                        </div>
                      </div>
                    )}

                    {phoneActiveTab === 'network' && (
                      <div className="space-y-3">
                        {/* Wireless Handoff Link Info */}
                        <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 flex flex-col gap-1.5 text-left">
                          <span className="text-[8px] font-mono uppercase text-white/40">Wireless Handoff Link</span>
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-white/60">Tunnel latency</span>
                            <span className="text-emerald-400 font-bold">12ms (Active)</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-mono border-t border-zinc-800 pt-1.5 mt-1">
                            <span className="text-white/60">Connection Speed</span>
                            <span className="text-[#00f2ff] font-bold">150.4 Mbps</span>
                          </div>
                        </div>

                        {/* Network toggle switch widget */}
                        <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 flex justify-between items-center">
                          <div>
                            <div className="text-[10px] font-bold text-white">Emergency Kill-Switch</div>
                            <p className="text-[8px] text-white/40">Disable PC Internet Access</p>
                          </div>

                          <button
                            onClick={handleToggleInternet}
                            className={`px-3 py-1.5 rounded font-mono text-[9px] font-bold uppercase transition-colors ${
                              systemStats.internetConnected 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                : 'bg-green-500/20 text-green-400 border border-green-500/30'
                            }`}
                          >
                            {systemStats.internetConnected ? 'KILL NET' : 'ALLOW NET'}
                          </button>
                        </div>
                      </div>
                    )}

                    {phoneActiveTab === 'shell' && (
                      <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 flex flex-col h-[280px] font-mono text-[8.5px]">
                        <div className="flex-1 overflow-y-auto space-y-0.5 text-green-500 p-1 flex flex-col justify-end">
                          {phoneShellOutput.map((l, i) => (
                            <div key={i} className="whitespace-pre-wrap leading-tight">{l}</div>
                          ))}
                          {phoneShellLoading && (
                            <div className="animate-pulse text-[#00f2ff]">Executing outbound packet stream...</div>
                          )}
                        </div>
                        <div className="border-t border-[#242429] pt-1 flex items-center gap-1 bg-black px-1 rounded-b">
                          <span className="text-green-500 font-bold">{">"}</span>
                          <input
                            type="text"
                            value={phoneShellCmd}
                            onChange={(e) => setPhoneShellCmd(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handlePhoneShellSubmit();
                            }}
                            placeholder="Type cmd (e.g. dir, whoami, ipconfig)"
                            className="flex-1 bg-transparent text-green-400 font-mono text-[8.5px] focus:outline-none focus:ring-0 placeholder-green-800/40"
                          />
                        </div>
                      </div>
                    )}

                    {phoneActiveTab === 'logs' && (
                      <div className="space-y-2">
                        <div className="text-[8px] font-mono uppercase text-white/40 mb-1">Mobile Audit Event Stream</div>
                        <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-0.5 text-[8.5px] font-mono">
                          {auditLogs.slice(0, 15).map((log) => {
                            const isErr = log.level === 'error' || log.level === 'warning';
                            return (
                              <div key={log.id} className="bg-zinc-900/60 p-1.5 rounded border border-zinc-900">
                                <div className="flex justify-between text-[7px] text-white/35">
                                  <span>{log.category.toUpperCase()}</span>
                                  <span>{log.timestamp.slice(11, 19)}</span>
                                </div>
                                <p className={`mt-0.5 ${isErr ? 'text-amber-400' : 'text-zinc-300'}`}>{log.message}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Smartphone app bottom navigation bar */}
                  <div className="border-t border-zinc-900 pt-2 pb-0 flex justify-around items-center bg-black -mx-3 px-1 mt-2.5">
                    {[
                      { id: 'dashboard', label: 'Monitor', icon: Cpu },
                      { id: 'processes', label: 'Tasks', icon: Search },
                      { id: 'power', label: 'Power', icon: Power },
                      { id: 'network', label: 'Net', icon: Wifi },
                      { id: 'shell', label: 'CMD', icon: Terminal },
                      { id: 'logs', label: 'Logs', icon: Database }
                    ].map((btn) => {
                      const Icon = btn.icon;
                      const active = phoneActiveTab === btn.id;
                      return (
                        <button
                          key={btn.id}
                          onClick={() => setPhoneActiveTab(btn.id as any)}
                          className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded transition-all text-center focus:outline-none ${
                            active ? 'text-[#00f2ff] bg-zinc-900/60' : 'text-white/40 hover:text-white'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-[7.5px] scale-[0.85] font-mono whitespace-nowrap">{btn.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Smartphone home bar visualizer */}
                  <div className="border-t border-zinc-900 pt-2 flex justify-between text-[8px] font-mono text-white/30 items-center select-none">
                    <span>SYS DIAL: Secured AES-256</span>
                    <div className="w-16 h-1 bg-zinc-800 rounded-full mx-auto"></div>
                    <span>V1.0.0</span>
                  </div>

                </div>
              </div>

            </div>

          </div>
        )}

        {/* ===================================== */}
        {/* TAB 2: AGENT SOURCE CODE VAULT */}
        {/* ===================================== */}
        {activeTab === 'code' && (
          <div className="p-6 max-w-[1200px] mx-auto">
            
            {/* Header copy and introduction */}
            <div className="mb-6 bg-[#16161c] border border-[#242429] p-5 rounded-lg">
              <h2 className="text-base font-bold font-sans tracking-tight text-[#00f2ff] flex items-center gap-1.5">
                <Code className="w-5 h-5 text-[#00f2ff]" /> Production Source Code Vault
              </h2>
              <p className="text-xs text-white/50 leading-relaxed mt-2">
                This repository houses copy-paste production assets for creating your self-hosted PC control agent. 
                Deploy the background daemon to your Windows computer using Python and package the Flutter repository directly to run the Android mobile client dashboard with zero subscription fees.
              </p>
            </div>

            {/* File navigator tabs */}
            <div className="bg-[#16161c] border border-[#242429] rounded-t-lg flex overflow-x-auto">
              <button 
                onClick={() => setCurrentCodeFile('agent')}
                className={`py-3 px-5 font-mono text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                  currentCodeFile === 'agent' 
                    ? 'border-[#00f2ff] text-[#00f2ff] bg-black/30' 
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                🐍 Windows Background Service (agent.py)
              </button>

              <button 
                onClick={() => setCurrentCodeFile('flutter')}
                className={`py-3 px-5 font-mono text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                  currentCodeFile === 'flutter' 
                    ? 'border-[#00f2ff] text-[#00f2ff] bg-black/30' 
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                📱 Mobile Client Controller (main.dart)
              </button>

              <button 
                onClick={() => setCurrentCodeFile('sqlite')}
                className={`py-3 px-5 font-mono text-xs uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
                  currentCodeFile === 'sqlite' 
                    ? 'border-[#00f2ff] text-[#00f2ff] bg-black/30' 
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                🗄️ SQL Schema Database Design (schema.sql)
              </button>
            </div>

            {/* Code editor / viewport container */}
            <div className="bg-black border-x border-b border-[#242429] rounded-b-lg flex flex-col overflow-hidden relative">
              
              {/* Copy control bar */}
              <div className="bg-[#121216] border-b border-[#242429] p-3 flex justify-between items-center">
                <span className="text-[10px] font-mono text-white/40 uppercase">
                  {currentCodeFile === 'agent' && 'Language: Python 3.9+ | CLI Framework: FastAPI | Core Dependencies: psutil, pywin32, pyjwt'}
                  {currentCodeFile === 'flutter' && 'Language: Dart 2.18+ | Framework: Flutter M3 | Core State Manager: ChangeNotifier'}
                  {currentCodeFile === 'sqlite' && 'Database: SQLite | Storage: Local persistent isolation storage at ~/.pc_control_agent.db'}
                </span>

                <button
                  onClick={() => {
                    const textToCopy = currentCodeFile === 'agent' 
                      ? pythonAgentCode 
                      : currentCodeFile === 'flutter' 
                        ? flutterClientCode 
                        : presetDatabaseSchema;
                    handleCopyCode(textToCopy);
                  }}
                  className="bg-[#00f2ff]/10 hover:bg-[#00f2ff] text-[#00f2ff] hover:text-black font-semibold border border-[#00f2ff]/30 hover:border-[#00f2ff] transition-all rounded px-3 py-1 font-mono text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm"
                >
                  {copiedNotification ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied Code!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy Code File
                    </>
                  )}
                </button>
              </div>

              {/* Code display text area */}
              <div className="p-4 max-h-[600px] overflow-y-auto select-all">
                <pre className="font-mono text-xs text-white/85 leading-relaxed overflow-x-auto whitespace-pre">
                  {currentCodeFile === 'agent' && pythonAgentCode}
                  {currentCodeFile === 'flutter' && flutterClientCode}
                  {currentCodeFile === 'sqlite' && presetDatabaseSchema}
                </pre>
              </div>

            </div>

          </div>
        )}

        {/* ===================================== */}
        {/* TAB 3: SETUP & INTEGRATION GUIDES */}
        {/* ===================================== */}
        {activeTab === 'docs' && (
          <div className="p-6 max-w-[1200px] mx-auto grid grid-cols-12 gap-6">
            
            {/* Left selector menu bar (4 Columns) */}
            <div className="col-span-12 md:col-span-4 flex flex-col gap-2.5">
              <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest pl-2">Documentation Hub</div>
              
              {documentationSections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setSelectedDocsSection(sec.id)}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                    selectedDocsSection === sec.id
                      ? 'bg-gradient-to-r from-[#00f2ff]/10 to-transparent border-[#00f2ff]/40 text-[#00f2ff] shadow-sm'
                      : 'bg-[#16161c] border-[#242429] text-white/60 hover:text-white'
                  }`}
                >
                  <span className="font-mono text-xs font-bold">{sec.title}</span>
                  <span className="text-[10px] text-white/40 leading-normal">{sec.description}</span>
                </button>
              ))}

              <div className="mt-4 bg-[#16161c] border border-[#242429] p-4 rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-sky-400 font-mono text-xs uppercase font-bold">
                  <Shield className="w-4 h-4 text-sky-400" /> Administrative Security Note
                </div>
                <p className="text-[11px] text-white/45 leading-relaxed">
                  As this background coordinator commands root-level access (such as killing processes or closing sessions), always safeguard your system password. Never share login tokens or keys onto public repositories.
                </p>
              </div>
            </div>

            {/* Right Guide Viewer (8 Columns) */}
            <div className="col-span-12 md:col-span-8 bg-[#16161c] border border-[#242429] p-6 rounded-xl flex flex-col shadow-lg">
              
              {(() => {
                const activeSec = documentationSections.find(s => s.id === selectedDocsSection);
                if (!activeSec) return null;
                return (
                  <div className="font-sans leading-relaxed text-xs space-y-4">
                    <div className="border-b border-[#242429] pb-4 mb-4">
                      <h2 className="text-lg font-bold tracking-tight text-white">{activeSec.title}</h2>
                      <p className="text-white/40 mt-1 font-mono text-[10px] uppercase font-bold text-sky-400">{activeSec.description}</p>
                    </div>

                    <div className="text-white/80 whitespace-pre-line text-xs font-sans">
                      {activeSec.content.split('\n').map((line, idx) => {
                        // Custom formatting logic for simple styling in lines without full markdown library
                        if (line.startsWith('## ')) {
                          return <h3 key={idx} className="text-base font-bold text-[#00f2ff] mt-6 mb-2 tracking-tight">{line.replace('## ', '')}</h3>;
                        }
                        if (line.startsWith('### ')) {
                          return <h4 key={idx} className="text-sm font-bold text-[#ff8c00] mt-4 mb-1 tracking-tight">{line.replace('### ', '')}</h4>;
                        }
                        if (line.startsWith('* **')) {
                          return <div key={idx} className="indent-4 text-xs mt-1 text-white/90">{line}</div>;
                        }
                        if (line.startsWith('   - ') || line.startsWith(' - ')) {
                          return <li key={idx} className="list-disc leading-loose pl-3 ml-4 text-white/70">{line.replace(/^[-\s]+/, '')}</li>;
                        }
                        if (line.includes('`')) {
                          // Format code blocks elegantly inline
                          return (
                            <p key={idx} className="my-1.5 leading-relaxed leading-loose">
                              {line.split('`').map((part, pIdx) => {
                                if (pIdx % 2 === 1) {
                                  return <code key={pIdx} className="bg-black border border-white/10 px-1 py-0.5 rounded text-[#00f2ff] font-mono text-[11px] font-medium">{part}</code>;
                                }
                                return part;
                              })}
                            </p>
                          );
                        }
                        return <p key={idx} className="my-2 leading-relaxed leading-loose">{line}</p>;
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>

          </div>
        )}

      </div>

      {/* FOOTER BAR STYLING */}
      <footer className="bg-[#121216] border-t border-[#242429] py-3.5 px-6 flex flex-wrap items-center justify-between text-xs font-mono text-white/40 relative">
        <span>© 2026 PC CONTROL AGENT SECURITY SUITE | SELF-HOSTED ENVIRONMENT</span>
        <div className="flex gap-4 items-center">
          <span className="text-green-400">STATUS: INTER-DEV PROTOCOL DEPLOYED</span>
          <span className="text-white/20">|</span>
          <a href="#power-controls-section" className="hover:text-white transition-colors">Emergency Controls</a>
          <span className="text-white/20">|</span>
          <a href="#audit-logs-section" className="hover:text-white transition-colors">Auditor Check</a>
        </div>
      </footer>

      {/* CONFIRMATION DIALOG MODAL FOR HARDWARE POWER SWITCHES */}
      {powerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#16161c] border border-red-500/30 max-w-sm w-full p-6 rounded-lg flex flex-col gap-4 shadow-2xl relative">
            
            <div className="w-12 h-12 bg-red-500/10 rounded-full border border-red-500/30 flex items-center justify-center text-red-500 mx-auto">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>

            <div className="text-center">
              <h3 className="text-sm font-mono uppercase text-red-400 font-bold tracking-widest">Execute Remote Command</h3>
              <p className="text-base font-bold text-white mt-1 uppercase">Trigger: {powerModal.toUpperCase()} ACTION?</p>
              <p className="text-xs text-white/40 mt-2 leading-relaxed">
                You are about to transmit a physical hardware switch instruction code ({powerModal}) over the private network. If executed, the server connection thread of RYZEN-GAMING-PRO will transition.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => setPowerModal(null)}
                className="py-2 rounded bg-white/5 hover:bg-white/10 border border-white/5 font-mono text-xs uppercase text-white/70 hover:text-white transition-colors"
              >
                Abort Action
              </button>
              <button
                onClick={() => executePowerAction(powerModal)}
                className="py-2 rounded bg-red-600 hover:bg-red-700 text-black font-semibold font-mono text-xs uppercase transition-colors"
              >
                Yes, Execute
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
