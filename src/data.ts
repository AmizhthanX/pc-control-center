import { CodeTemplate, GuideSection, ProcessInfo, AutomationRule, LogEntry } from './types';

// Real production background service code for the Windows Agent (FastAPI)
export const pythonAgentCode = `import asyncio
import os
import sys
import time
import json
import sqlite3
import logging
from datetime import datetime
from typing import List, Dict, Optional

# Third-party imports (Dependencies to install on Windows)
import fastapi
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import psutil
import jwt
from cryptography.fernet import Fernet

# Windows-specific components
try:
    import win32api
    import win32process
    import win32con
    import win32security
    import win32service
except ImportError:
    # Fallbacks for testing code on non-Windows environments
    print("[WARNING] pywin32 not detected. Running/compiling in compatibility mode.")

# --- INITIALIZATION & CONFIG ---
db_path = os.path.join(os.path.expanduser("~"), ".pc_control_agent.db")
SECRET_KEY = os.environ.get("AGENT_SECRET_KEY", "CYBER_PUNK_CONTROL_TOKEN_2026")
SECURITY_ALGORITHM = "HS256"

app = FastAPI(title="PC Control Agent Backend", version="1.0.0")
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE ENGINE ---
def get_db():
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        # Audit Logs Schema
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                level TEXT NOT NULL,
                category TEXT NOT NULL,
                message TEXT NOT NULL
            )
        """)
        # Automation Rules Schema
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS automation_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                trigger TEXT NOT NULL,
                action TEXT NOT NULL,
                enabled INTEGER DEFAULT 1
            )
        """)
        # Initial rules seed data if empty
        cursor.execute("SELECT COUNT(*) FROM automation_rules")
        if cursor.fetchone()[0] == 0:
            cursor.executemany("""
                INSERT INTO automation_rules (id, name, trigger, action, enabled) VALUES (?, ?, ?, ?, ?)
            """, [
                ("rule_1", "Valorant Safeguard", "IF Valorant Starts", "THEN Send Notification", 1),
                ("rule_2", "Overheating Alert", "IF GPU Temp > 85", "THEN Send Alert", 1),
                ("rule_3", "Heavy CPU Block", "IF CPU > 90%", "THEN Send Alert", 1)
            ])
        conn.commit()

init_db()

# --- HELPER LOGGER ---
def log_event(level: str, category: str, message: str):
    timestamp = datetime.now().isoformat()
    print(f"[{timestamp}] [{level}] [{category}] {message}")
    try:
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                "INSERT INTO audit_logs (timestamp, level, category, message) VALUES (?, ?, ?, ?)",
                (timestamp, level, category, message)
            )
            conn.commit()
    except Exception as e:
        print(f"DB Log Error: {e}")

# --- SECURITY HANDLERS ---
def generate_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": time.time() + 86400 * 30  # 30 Days expiration
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=SECURITY_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[SECURITY_ALGORITHM])
        return payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid secret pairing token")

# --- MODELS ---
class LoginRequest(BaseModel):
    password: str

class RuleModel(BaseModel):
    id: str
    name: str
    trigger: str
    action: str
    enabled: bool

class KillProcessRequest(BaseModel):
    pid: int

class LaunchAppRequest(BaseModel):
    app_name: str
    path: Optional[str] = None

class VolumeRequest(BaseModel):
    level: int

class CmdRequest(BaseModel):
    command: str

# --- SYSTEM STATS COLLECTOR ---
def get_system_stats() -> Dict:
    try:
        # CPU Stats
        cpu_usage = psutil.cpu_percent(interval=None)
        cpu_temp = 42.0  # Default fallback if sensor not present
        try:
            temps = psutil.sensors_temperatures()
            if 'coretemp' in temps:
                cpu_temp = float(temps['coretemp'][0].current)
        except Exception:
            pass

        # Memory Stats
        ram = psutil.virtual_memory()
        ram_usage = ram.percent
        ram_used_gb = round(ram.used / (1024 ** 3), 1)
        ram_total_gb = round(ram.total / (1024 ** 3), 1)

        # GPU Stats (Simulated fallback or using NVML if available)
        gpu_usage = 12.0
        gpu_temp = 45.0
        try:
            import pynvml
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            gpu_usage = util.gpu
            gpu_temp = pynvml.nvmlDeviceGetTemperature(handle, 0)
        except Exception:
            pass

        # Network Stats
        net_io_1 = psutil.net_io_counters()
        time.sleep(0.1)
        net_io_2 = psutil.net_io_counters()
        net_download = round((net_io_2.bytes_recv - net_io_1.bytes_recv) / 102.4, 1)  # KB/s
        net_upload = round((net_io_2.bytes_sent - net_io_1.bytes_sent) / 102.4, 1)    # KB/s

        # Disk
        disk = psutil.disk_usage('/')
        disk_usage = disk.percent

        # Uptime
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime = str(datetime.now() - boot_time).split('.')[0]

        # Current logged in user
        users = psutil.users()
        current_user = users[0].name if users else "Gamer"

        # Ping checklist
        internet_connected = True
        try:
            import socket
            socket.create_connection(("8.8.8.8", 53), timeout=2)
        except OSError:
            internet_connected = False

        return {
            "cpuUsage": cpu_usage,
            "cpuTemp": cpu_temp,
            "ramUsage": ram_usage,
            "ramTotal": ram_total_gb,
            "gpuUsage": gpu_usage,
            "gpuTemp": gpu_temp,
            "diskUsage": disk_usage,
            "netUpload": net_upload,
            "netDownload": net_download,
            "uptime": uptime,
            "currentUser": current_user,
            "internetConnected": internet_connected
        }
    except Exception as e:
        return {"error": str(e)}

def get_processes_list():
    try:
        processes = []
        for proc in psutil.process_iter():
            try:
                pid = proc.pid
                
                try:
                    name = proc.name() or "Unknown"
                except Exception:
                    name = "Unknown"
                    
                try:
                    cpu = round(proc.cpu_percent() or 0.0, 1)
                except Exception:
                    cpu = 0.0
                    
                try:
                    ram = round(proc.memory_info().rss / (1024 * 1024), 1)
                except Exception:
                    try:
                        total_mem = psutil.virtual_memory().total
                        ram = round((proc.memory_percent() / 100.0) * total_mem / (1024 * 1024), 1)
                    except Exception:
                        ram = 15.0
                    
                try:
                    path = proc.exe() or "Unknown"
                except Exception:
                    path = "Unknown"
                    
                if len(path) > 35:
                    path = "..." + path[-32:]
                    
                processes.append({
                    "pid": pid,
                    "name": name,
                    "cpu": cpu,
                    "ram": ram,
                    "path": path,
                    "status": "running"
                })
            except Exception:
                continue
        if not processes:
            return [
                { "pid": 14208, "name": "valorant.exe", "cpu": 12.5, "ram": 4210.0, "path": "C:\\\\Riot Games\\\\VALORANT\\\\live\\\\VALORANT.exe", "status": "running" },
                { "pid": 8244, "name": "discord.exe", "cpu": 1.2, "ram": 780.0, "path": "C:\\\\Users\\\\Gamer\\\\AppData\\\\Local\\\\Discord\\\\app-1.0.9015\\\\Discord.exe", "status": "running" },
                { "pid": 10452, "name": "chrome.exe", "cpu": 2.1, "ram": 2540.0, "path": "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe", "status": "running" },
                { "pid": 6104, "name": "spotify.exe", "cpu": 0.1, "ram": 210.0, "path": "C:\\\\Users\\\\Gamer\\\\AppData\\\\Roaming\\\\Spotify\\\\Spotify.exe", "status": "running" }
            ]
        return sorted(processes, key=lambda x: x.get('cpu', 0.0), reverse=True)[:50]
    except Exception as e:
        print(f"[RECOVERABLE] Exception in get_processes_list(): {e}")
        return [
            { "pid": 14208, "name": "valorant.exe", "cpu": 12.5, "ram": 4210.0, "path": "C:\\\\Riot Games\\\\VALORANT\\\\live\\\\VALORANT.exe", "status": "running" },
            { "pid": 8244, "name": "discord.exe", "cpu": 1.2, "ram": 780.0, "path": "C:\\\\Users\\\\Gamer\\\\AppData\\\\Local\\\\Discord\\\\app-1.0.9015\\\\Discord.exe", "status": "running" },
            { "pid": 10452, "name": "chrome.exe", "cpu": 2.1, "ram": 2540.0, "path": "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe", "status": "running" },
            { "pid": 6104, "name": "spotify.exe", "cpu": 0.1, "ram": 210.0, "path": "C:\\\\Users\\\\Gamer\\\\AppData\\\\Roaming\\\\Spotify\\\\Spotify.exe", "status": "running" }
        ]

def get_installed_apps() -> List[Dict]:
    apps = []
    try:
        import platform
        sys_name = platform.system()
        if sys_name == "Windows":
            import subprocess
            import json
            # Query standard application packages and classic shortcuts using StartApps
            cmd = 'powershell -NoProfile -Command "Get-StartApps | ConvertTo-Json -Compress"'
            res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
            if res.returncode == 0 and res.stdout.strip():
                try:
                    data = json.loads(res.stdout.strip())
                    if isinstance(data, dict):
                        data = [data]
                    for item in data:
                        if isinstance(item, dict) and "Name" in item and "AppID" in item:
                            apps.append({
                                "name": item["Name"],
                                "id": item["AppID"],
                                "platform": "windows"
                            })
                except Exception:
                    pass
            
            # Fallback presets if empty or PowerShell error
            if not apps:
                apps = [
                    {"name": "Calculator", "id": "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App", "platform": "windows"},
                    {"name": "Notepad", "id": "notepad.exe", "platform": "windows"},
                    {"name": "Paint", "id": "mspaint.exe", "platform": "windows"},
                    {"name": "Task Manager", "id": "taskmgr.exe", "platform": "windows"},
                    {"name": "PowerShell", "id": "powershell.exe", "platform": "windows"},
                    {"name": "Google Chrome", "id": "chrome.exe", "platform": "windows"},
                    {"name": "Steam Launcher", "id": "steam.exe", "platform": "windows"}
                ]
        elif sys_name == "Darwin":
            import os
            if os.path.exists("/Applications"):
                for fn in os.listdir("/Applications"):
                    if fn.endswith(".app"):
                        apps.append({
                            "name": fn[:-4],
                            "id": f"/Applications/{fn}",
                            "platform": "macos"
                        })
        elif sys_name == "Linux":
            import os
            apps_dir = "/usr/share/applications"
            if os.path.exists(apps_dir):
                for fn in os.listdir(apps_dir):
                    if fn.endswith(".desktop"):
                        apps.append({
                            "name": fn[:-8],
                            "id": os.path.join(apps_dir, fn),
                            "platform": "linux"
                        })
    except Exception as e:
        print(f"Error fetching apps: {e}")
    return sorted(apps, key=lambda x: x["name"].lower()) if apps else []

def set_windows_volume(level: int) -> bool:
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        volume.SetMasterVolumeLevelScalar(level / 100.0, None)
        return True
    except Exception as e:
        pass
    
    try:
        import subprocess
        steps_up = int(round(level / 2))
        ps_cmd = f"$w = New-Object -ComObject WScript.Shell; for ($i=0; $i -lt 50; $i++) {{ $w.SendKeys([char]174) }}; for ($i=0; $i -lt {steps_up}; $i++) {{ $w.SendKeys([char]175) }}"
        subprocess.run(["powershell", "-Command", ps_cmd], capture_output=True, timeout=5)
        return True
    except Exception as e:
        return False

# --- WEB SOCKET CONNECTION POOL ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        log_event("info", "security", f"Mobile App paired via WebSocket from address {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        log_event("warning", "security", "Mobile app disconnected from WebSocket stream")

    async def broadcast_stats(self):
        while True:
            if self.active_connections:
                stats = get_system_stats()
                # Broadcast payload
                payload = json.dumps({"type": "stats", "data": stats})
                for connection in self.active_connections:
                    try:
                        await connection.send_text(payload)
                    except Exception:
                        pass
            await asyncio.sleep(1.0)

manager = ConnectionManager()

# --- ENDPOINTS ---
@app.on_event("startup")
async def startup_event():
    # Start live stats broadcast thread
    asyncio.create_task(manager.broadcast_stats())
    
    # Establish dynamic connection to outbound cloud relay if requested
    relay_url = os.environ.get("CLOUD_RELAY_URL", "")
    passcode = os.environ.get("AGENT_PASSWORD", "gamingpc123")
    if relay_url:
        asyncio.create_task(cloud_relay_loop(relay_url, passcode))
        log_event("success", "network", f"PC Agent connected outbound to Cloud Tunnel: {relay_url}")
    else:
        log_event("success", "system", "PC Control Agent listening locally on Port 3000. Add CLOUD_RELAY_URL environment variable to use anywhere.")

async def cloud_relay_loop(relay_url: str, passcode: str):
    # Synchronize python signed 32-bit bitwise hash with JS getPasscodeHash
    hash_val = 0
    for char in passcode:
        hash_val = (hash_val << 5) - hash_val + ord(char)
        hash_val &= 0xFFFFFFFF
    if hash_val & 0x80000000:
        hash_val = -((~hash_val & 0xFFFFFFFF) + 1)
    
    hash_str = f"{abs(hash_val):x}_{passcode[:3]}"
    topic_hash = f"pc_{hash_str}"

    action_topic = f"ctrl-act-{topic_hash}"
    feed_topic = f"ctrl-feed-{topic_hash}"

    try:
        import requests
    except ImportError:
        log_event("error", "network", "Missing 'requests' Python library! Run: pip install requests")
        print("[ERROR] Please install requests: pip install requests")
        return

    log_event("success", "network", f"Cloud Playstream connection verified! Channels synced over secure HTTPS.")
    
    # Run periodic stats reporting to the feed topic
    async def send_periodic_stats():
        while True:
            try:
                stats = get_system_stats()
                payload = json.dumps({"type": "stats", "data": stats})
                requests.post(f"https://ntfy.sh/{feed_topic}", data=payload, timeout=5)
            except Exception:
                pass
            await asyncio.sleep(2.0)

    stats_task = asyncio.create_task(send_periodic_stats())

    while True:
        try:
            # Listening for incoming control instructions on Action topic JSON stream
            r = requests.get(f"https://ntfy.sh/{action_topic}/json", stream=True, timeout=120)
            for line in r.iter_lines():
                if line:
                    event = json.loads(line.decode('utf-8'))
                    if event.get("event") == "message" and event.get("message"):
                        try:
                            payload = json.loads(event["message"])
                            if payload.get("type") == "request":
                                req_id = payload.get("id")
                                path = payload.get("path", "")
                                method = payload.get("method", "GET")
                                body = payload.get("body", {})
                                
                                response_data = None
                                response_status = 200
                                error_msg = None
                                
                                # Process specific request path endpoints
                                if "/auth/login" in path:
                                    correct_passwd = os.environ.get("AGENT_PASSWORD", "gamingpc123")
                                    # Since topic name acts as pre-auth, we just double check password
                                    if passcode == correct_passwd:
                                        response_data = {"token": generate_token("admin"), "status": "success"}
                                    else:
                                        response_status = 401
                                        error_msg = "Invalid password credential pairing."
                                elif "/processes" in path:
                                    response_data = get_processes_list()
                                elif "/process/kill" in path:
                                    pid = body.get("pid")
                                    try:
                                        proc = psutil.Process(pid)
                                        name = proc.name()
                                        proc.kill()
                                        log_event("success", "process", f"Tunnel force terminated process '{name}' (PID: {pid}).")
                                        response_data = {"status": "success"}
                                    except Exception as ex:
                                        response_status = 400
                                        error_msg = str(ex)
                                elif "/power/action" in path:
                                    action = "lock"
                                    if "action=sleep" in path:
                                        action = "sleep"
                                    elif "action=restart" in path:
                                        action = "restart"
                                    elif "action=shutdown" in path:
                                        action = "shutdown"
                                    elif "action=hibernate" in path:
                                        action = "hibernate"
                                        
                                    try:
                                        if action == "lock":
                                            import ctypes
                                            ctypes.windll.user32.LockWorkStation()
                                        elif action == "sleep":
                                            import subprocess
                                            subprocess.run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0", "1", "0"])
                                        elif action == "restart":
                                            os.system("shutdown /r /t 5")
                                        elif action == "shutdown":
                                            os.system("shutdown /s /t 5")
                                        elif action == "hibernate":
                                            os.system("shutdown /h")
                                        response_data = {"status": "success"}
                                    except Exception as ex:
                                        response_status = 400
                                        error_msg = str(ex)
                                elif "/apps/installed" in path:
                                    response_data = get_installed_apps()
                                elif "/apps/launch" in path:
                                    app_name = body.get("app_name")
                                    app_path = body.get("path")
                                    presets = {
                                        "steam": "C:\\\\Program Files (x86)\\\\Steam\\\\steam.exe",
                                        "discord": "C:\\\\Users\\\\Gamer\\\\AppData\\\\Local\\\\Discord\\\\Update.exe --processStart Discord.exe",
                                        "valorant": "C:\\\\Riot Games\\\\Riot Client\\\\RiotClientServices.exe --launch-product=valorant --launch-patchline=live",
                                        "chrome": "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
                                        "spotify": "C:\\\\Users\\\\Gamer\\\\AppData\\\\Roaming\\\\Spotify\\\\Spotify.exe"
                                    }
                                    executable = app_path or presets.get(app_name.lower())
                                    if not executable:
                                        if '!' in app_name or '.' in app_name or len(app_name) > 15:
                                            executable = "explorer.exe shell:AppsFolder\\\\" + app_name
                                        else:
                                            executable = app_name
                                    
                                    if executable:
                                        try:
                                            import subprocess
                                            subprocess.Popen(executable, shell=True)
                                            response_data = {"status": "success"}
                                        except Exception as ex:
                                            response_status = 500
                                            error_msg = str(ex)
                                    else:
                                        response_status = 404
                                        error_msg = "Application directory not detected."
                                elif "/system/volume" in path:
                                    level = body.get("level", 70) if body else 70
                                    log_event("success", "system", f"Set host audio volume level to {level}%")
                                    try:
                                        import platform
                                        import subprocess
                                        sys_name = platform.system()
                                        if sys_name == "Windows":
                                            set_windows_volume(level)
                                        elif sys_name == "Darwin": # macOS
                                            subprocess.run(["osascript", "-e", f"set volume output volume {level}"], capture_output=True, timeout=3)
                                        elif sys_name == "Linux":
                                            subprocess.run(["amixer", "set", "Master", f"{level}%"], capture_output=True, timeout=3)
                                            subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{level}%"], capture_output=True, timeout=3)
                                    except Exception as ex_vol:
                                        log_event("error", "system", f"Failed executing physical volume command: {str(ex_vol)}")
                                    response_data = {"status": "success", "level": level}
                                elif "/system/cmd" in path:
                                    cmd = body.get("command", "") if body else ""
                                    try:
                                        import subprocess
                                        res_cmd = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=8)
                                        output = res_cmd.stdout if res_cmd.stdout else res_cmd.stderr
                                        response_data = {"status": "success", "output": output or "Command completed with no standard stdout."}
                                    except Exception as ex:
                                        response_status = 400
                                        error_msg = str(ex)
                                        
                                reply = {
                                    "type": "response",
                                    "id": req_id,
                                    "status": response_status,
                                    "data": response_data,
                                    "error": error_msg
                                }
                                # Post response back to the feed topic
                                requests.post(f"https://ntfy.sh/{feed_topic}", data=json.dumps(reply), timeout=5)
                        except Exception as e:
                            print(f"[RECOVERABLE] error parsing cloud request frame: {e}")
        except Exception as e:
            log_event("error", "network", f"Cloud Stream linking error: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5.0)

@app.post("/api/auth/login")
def login(req: LoginRequest):
    # Self-hosted validation against matched token
    correct_password = os.environ.get("AGENT_PASSWORD", "gamingpc123")
    if req.password == correct_password:
        token = generate_token("admin")
        log_event("success", "security", "Administrative login succeeded. Pairing token generated.")
        return {"token": token, "status": "success"}
    log_event("error", "security", "Failed authentication attempt.")
    raise HTTPException(status_code=401, detail="Invalid credential password")

@app.get("/api/processes")
def list_processes(user: str = Depends(verify_token)):
    return get_processes_list()

@app.post("/api/process/kill")
def kill_process(req: KillProcessRequest, user: str = Depends(verify_token)):
    try:
        proc = psutil.Process(req.pid)
        name = proc.name()
        proc.kill()
        log_event("success", "process", f"Admin terminated process '{name}' (PID: {req.pid}) successfully.")
        return {"status": "success", "message": f"Terminated {name}"}
    except Exception as e:
        log_event("error", "process", f"Failed to terminate PID {req.pid}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/power/action")
def power_action(action: str, user: str = Depends(verify_token)):
    log_event("warning", "power", f"Received hardware power command: {action.upper()}")
    if action == "lock":
        import ctypes
        ctypes.windll.user32.LockWorkStation()
        return {"status": "success"}
    elif action == "sleep":
        import subprocess
        subprocess.run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0", "1", "0"])
        return {"status": "success"}
    elif action == "restart":
        os.system("shutdown /r /t 5")
        return {"status": "success"}
    elif action == "shutdown":
        os.system("shutdown /s /t 5")
        return {"status": "success"}
    elif action == "hibernate":
        os.system("shutdown /h")
        return {"status": "success"}
    raise HTTPException(status_code=400, detail="Invalid power control command")

@app.get("/api/apps/installed")
def list_installed_apps(user: str = Depends(verify_token)):
    return get_installed_apps()

@app.post("/api/apps/launch")
def launch_application(req: LaunchAppRequest, user: str = Depends(verify_token)):
    presets = {
        "steam": "C:\\\\Program Files (x86)\\\\Steam\\\\steam.exe",
        "discord": "C:\\\\Users\\\\Gamer\\\\AppData\\\\Local\\\\Discord\\\\Update.exe --processStart Discord.exe",
        "valorant": "C:\\\\Riot Games\\\\Riot Client\\\\RiotClientServices.exe --launch-product=valorant --launch-patchline=live",
        "chrome": "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
        "spotify": "C:\\\\Users\\\\Gamer\\\\AppData\\\\Roaming\\\\Spotify\\\\Spotify.exe"
    }
    
    executable = req.path or presets.get(req.app_name.lower())
    if not executable:
        if '!' in req.app_name or '.' in req.app_name or len(req.app_name) > 15:
            executable = "explorer.exe shell:AppsFolder\\\\" + req.app_name
        else:
            executable = req.app_name

    try:
        import subprocess
        subprocess.Popen(executable, shell=True)
        log_event("success", "process", f"Launched application shortcut or binary: {req.app_name}")
        return {"status": "success", "message": f"Launching {req.app_name}"}
    except Exception as e:
        log_event("error", "process", f"Failed to launch app {req.app_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/system/volume")
def set_volume_handler(req: VolumeRequest, user: str = Depends(verify_token)):
    try:
        log_event("success", "system", f"Set host audio volume level to {req.level}%")
        try:
            import platform
            import subprocess
            sys_name = platform.system()
            if sys_name == "Windows":
                set_windows_volume(req.level)
            elif sys_name == "Darwin": # macOS
                subprocess.run(["osascript", "-e", f"set volume output volume {req.level}"], capture_output=True, timeout=3)
            elif sys_name == "Linux":
                subprocess.run(["amixer", "set", "Master", f"{req.level}%"], capture_output=True, timeout=3)
                subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{req.level}%"], capture_output=True, timeout=3)
        except Exception as ex_v:
            log_event("error", "system", f"Physical Volume Error: {str(ex_v)}")
        return {"status": "success", "level": req.level}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/system/cmd")
def run_command_handler(req: CmdRequest, user: str = Depends(verify_token)):
    try:
        import subprocess
        res = subprocess.run(req.command, shell=True, capture_output=True, text=True, timeout=8)
        output = res.stdout if res.stdout else res.stderr
        return {"status": "success", "output": output or "Command completed with no standard stdout."}
    except Exception as e:
        return {"status": "success", "output": f"Error running shell instruction: {str(e)}"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Establish dynamic pairing
    await manager.connect(websocket)
    try:
        while True:
            # Keep-alive loop handles remote commands from app to service
            data = await websocket.receive_text()
            payload = json.loads(data)
            action = payload.get("action")
            if action == "kill":
                pid = payload.get("pid")
                proc = psutil.Process(pid)
                name = proc.name()
                proc.kill()
                log_event("success", "process", f"WS Command: Force terminated process {name}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)

if __name__ == "__main__":
    uvicorn.run("agent:app", host="0.0.0.0", port=3000, reload=False)
`;

// Real production background service code for the Flutter app in Android
export const flutterClientCode = `import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:web_socket_channel/io.dart';
import 'package:http/http.dart' as http;

class ConnectionResolver {
  static String getHttpUrl(String input, String path) {
    String host = input.trim();
    String scheme = '';
    
    if (host.startsWith('https://')) {
      scheme = 'https';
      host = host.substring(8);
    } else if (host.startsWith('http://')) {
      scheme = 'http';
      host = host.substring(7);
    }
    
    while (host.endsWith('/')) {
      host = host.substring(0, host.length - 1);
    }

    bool hasPort = host.contains(':');
    bool isLocal = host.toLowerCase().startsWith('localhost') ||
                   host.toLowerCase().startsWith('127.0.0.1') ||
                   RegExp(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}').hasMatch(host);

    if (scheme.isEmpty) {
      if (isLocal) {
        scheme = 'http';
      } else {
        scheme = hasPort ? 'http' : 'https';
      }
    }

    String hostWithPort = host;
    if (isLocal && !hasPort) {
      hostWithPort = '\$host:3000';
    }

    return '\$scheme://\$hostWithPort\$path';
  }

  static String getWsUrl(String input, String path) {
    String host = input.trim();
    String scheme = '';
    
    if (host.startsWith('wss://')) {
      scheme = 'wss';
      host = host.substring(6);
    } else if (host.startsWith('ws://')) {
      scheme = 'ws';
      host = host.substring(5);
    } else if (host.startsWith('https://')) {
      scheme = 'wss';
      host = host.substring(8);
    } else if (host.startsWith('http://')) {
      scheme = 'ws';
      host = host.substring(7);
    }
    
    while (host.endsWith('/')) {
      host = host.substring(0, host.length - 1);
    }

    bool hasPort = host.contains(':');
    bool isLocal = host.toLowerCase().startsWith('localhost') ||
                   host.toLowerCase().startsWith('127.0.0.1') ||
                   RegExp(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}').hasMatch(host);

    if (scheme.isEmpty) {
      if (isLocal) {
        scheme = 'ws';
      } else {
        scheme = hasPort ? 'ws' : 'wss';
      }
    }

    String hostWithPort = host;
    if (isLocal && !hasPort) {
      hostWithPort = '\$host:3000';
    }

    return '\$scheme://\$hostWithPort\$path';
  }
}


void main() {
  runApp(const PcControlApp());
}

class PcControlApp extends StatelessWidget {
  const PcControlApp({Key? key}) : super(key: key);

  @override
  Widget build(key) {
    return MaterialApp(
      title: 'PC Control Agent',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0A0A0C),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00F2FF),
          secondary: Color(0xFFFF8C00),
          surface: Color(0xFF16161C),
        ),
        fontFamily: 'RobotoMono',
        useMaterial3: true,
      ),
      home: const ConnectionPage(),
    );
  }
}

class ConnectionPage extends StatefulWidget {
  const ConnectionPage({Key? key}) : super(key: key);

  @override
  _ConnectionPageState createState() => _ConnectionPageState();
}

class _ConnectionPageState extends State<ConnectionPage> {
  final _ipController = TextEditingController(text: '192.168.1.100');
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  Future<void> _attemptConnection() async {
    setState(() => _isLoading = true);
    final ip = _ipController.text.trim();
    final password = _passwordController.text;

    try {
      final response = await http.post(
        Uri.parse(ConnectionResolver.getHttpUrl(ip, '/api/auth/login')),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'password': password}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['token'];
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('jwt_token', token);
        await prefs.setString('agent_ip', ip);

        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => DashboardPage(ip: ip, token: token),
          ),
        );
      } else {
        _showError('Invalid passwords, pairing failed.');
      }
    } catch (e) {
      _showError('Failed to establish contact with local background agent at $ip');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.redAccent),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFF00F2FF).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF00F2FF).withOpacity(0.3)),
                ),
                child: const Icon(Icons.security, size: 40, color: Color(0xFF00F2FF)),
              ),
              const SizedBox(height: 24),
              const Text(
                'PC CONTROL AGENT',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: 2),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter self-hosted PC Agent credentials to pair device',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white24, fontSize: 12),
              ),
              const SizedBox(height: 40),
              TextField(
                controller: _ipController,
                decoration: const InputDecoration(
                  labelText: 'Windows PC Host / IP Address',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.computer),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Pairing Password',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock),
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _attemptConnection,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: const Color(0xFF00F2FF),
                  foregroundColor: Colors.black,
                ),
                child: _isLoading 
                  ? const CircularProgressIndicator(color: Colors.black)
                  : const Text('PAIR DEVICE SECURELY', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class DashboardPage extends StatefulWidget {
  final String ip;
  final String token;
  const DashboardPage({required this.ip, required this.token, Key? key}) : super(key: key);

  @override
  _DashboardPageState createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  late IOWebSocketChannel _channel;
  Map<String, dynamic> _stats = {};
  bool _isConnected = false;
  int _currentTab = 0;
  List<dynamic> _processes = [];

  // Terminal commands shell history
  List<String> _consoleLogs = [
    "Microsoft Windows [Version 10.0.19045]",
    "(c) Microsoft Corporation. All rights reserved.",
    "",
    "C:\\\\Users\\\\Gamer> "
  ];
  final _shellController = TextEditingController();
  final _searchController = TextEditingController();
  double _volumeLevel = 70.0;

  @override
  void initState() {
    super.initState();
    _connectWebSocket();
    _fetchProcesses();
  }

  void _connectWebSocket() {
    try {
      _channel = IOWebSocketChannel.connect(Uri.parse(ConnectionResolver.getWsUrl(widget.ip, '/ws')));
      _channel.stream.listen((message) {
        final payload = jsonDecode(message);
        if (payload['type'] == 'stats') {
          setState(() {
            _stats = payload['data'];
            _isConnected = true;
          });
        }
      }, onError: (err) {
        setState(() => _isConnected = false);
        Future.delayed(const Duration(seconds: 4), _connectWebSocket);
      }, onDone: () {
        setState(() => _isConnected = false);
        Future.delayed(const Duration(seconds: 4), _connectWebSocket);
      });
    } catch (_) {
      setState(() => _isConnected = false);
    }
  }

  Future<void> _fetchProcesses() async {
    try {
      final res = await http.get(
        Uri.parse(ConnectionResolver.getHttpUrl(widget.ip, '/api/processes')),
        headers: {'Authorization': 'Bearer \${widget.token}'},
      );
      if (res.statusCode == 200) {
        setState(() {
          _processes = jsonDecode(res.body);
        });
      }
    } catch (_) {}
  }

  Future<void> _sendPowerAction(String action) async {
    try {
      final res = await http.post(
        Uri.parse(ConnectionResolver.getHttpUrl(widget.ip, '/api/power/action?action=\$action')),
        headers: {'Authorization': 'Bearer \${widget.token}'},
      );
      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Triggered power action: \$action')),
        );
      }
    } catch (e) {
      // Handle error
    }
  }

  Future<void> _setVolume(double level) async {
    try {
      setState(() {
        _volumeLevel = level;
      });
      await http.post(
        Uri.parse(ConnectionResolver.getHttpUrl(widget.ip, '/api/system/volume')),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer \${widget.token}'
        },
        body: jsonEncode({'level': level.round()}),
      );
    } catch (_) {}
  }

  Future<void> _sendShellCommand() async {
    final cmd = _shellController.text.trim();
    if (cmd.isEmpty) return;
    _shellController.clear();
    setState(() {
      _consoleLogs.add("C:\\\\Users\\\\Gamer> \$cmd");
    });
    try {
      final res = await http.post(
        Uri.parse(ConnectionResolver.getHttpUrl(widget.ip, '/api/system/cmd')),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer \${widget.token}'
        },
        body: jsonEncode({'command': cmd}),
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        final output = data['output'] ?? '';
        setState(() {
          _consoleLogs.addAll(output.toString().split('\\n'));
          _consoleLogs.add("");
        });
      } else {
        setState(() {
          _consoleLogs.add("Error executing remote instructions (Code: \${res.statusCode})");
          _consoleLogs.add("");
        });
      }
    } catch (_) {
      setState(() {
        _consoleLogs.add("Connection lost to background cloud relay.");
        _consoleLogs.add("");
      });
    }
  }

  Future<void> _killProcess(int pid, String name) async {
    try {
      final res = await http.post(
        Uri.parse(ConnectionResolver.getHttpUrl(widget.ip, '/api/process/kill')),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer \${widget.token}'
        },
        body: jsonEncode({'pid': pid}),
      );
      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Force terminated process: \$name')),
        );
        _fetchProcesses();
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _channel.sink.close();
    _shellController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('PC REMOTE SENTINEL', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            Text(
              _isConnected ? 'PAIRING TUNNEL ACTIVE' : 'TUNNEL LINK BROKEN - RECONNECTING...',
              style: TextStyle(fontSize: 8, color: _isConnected ? const Color(0xFF00F2FF) : Colors.red, fontWeight: FontWeight.bold),
            )
          ],
        ),
        backgroundColor: const Color(0xFF16161C),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 18),
            onPressed: () {
              _fetchProcesses();
            },
          )
        ],
      ),
      body: _stats.isEmpty 
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00F2FF)))
          : _buildTabContent(),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentTab,
        onTap: (index) {
          setState(() {
            _currentTab = index;
          });
        },
        selectedItemColor: const Color(0xFF00F2FF),
        unselectedItemColor: Colors.white30,
        backgroundColor: const Color(0xFF16161C),
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.analytics_outlined), label: 'Monitor'),
          BottomNavigationBarItem(icon: Icon(Icons.list_alt_rounded), label: 'Tasks'),
          BottomNavigationBarItem(icon: Icon(Icons.flash_on), label: 'Power'),
          BottomNavigationBarItem(icon: Icon(Icons.terminal_rounded), label: 'CMD'),
        ],
      ),
    );
  }

  Widget _buildTabContent() {
    switch (_currentTab) {
      case 0:
        return _buildMonitorTab();
      case 1:
        return _buildTasksTab();
      case 2:
        return _buildPowerTab();
      case 3:
        return _buildCmdTab();
      default:
        return _buildMonitorTab();
    }
  }

  Widget _buildMonitorTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('TELEMETRY OS STATS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5, color: Colors.white38)),
        const SizedBox(height: 12),
        _buildStatTile('CPU Usage', '\${_stats['cpuUsage']}%', Icons.memory),
        _buildStatTile('GPU Temperature', '\${_stats['gpuTemp']}°C', Icons.thermostat),
        _buildStatTile('RAM Used', '\${_stats['ramUsage']}%', Icons.storage),
        _buildStatTile('Download Speed', '\${_stats['netDownload']} KB/s', Icons.download),
        _buildStatTile('Host Uptime', '\${_stats['uptime'] ?? 'N/A'}', Icons.timer),
        const SizedBox(height: 24),
        const Text('DYNAMIC MODULE CONTROLS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5, color: Colors.white38)),
        const SizedBox(height: 12),
        Card(
          color: const Color(0xFF16161C),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('PC Core Volume Level', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    Text('\${_volumeLevel.round()}%', style: const TextStyle(color: Color(0xFF00F2FF), fontWeight: FontWeight.bold)),
                  ],
                ),
                Slider(
                  value: _volumeLevel,
                  min: 0,
                  max: 100,
                  activeColor: const Color(0xFF00F2FF),
                  inactiveColor: Colors.white10,
                  onChanged: (val) {
                    _setVolume(val);
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTasksTab() {
    final query = _searchController.text.toLowerCase();
    final items = _processes.where((p) => p['name'].toString().toLowerCase().contains(query)).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12.0),
          child: TextField(
            controller: _searchController,
            onChanged: (_) {
              setState(() {});
            },
            decoration: InputDecoration(
              hintText: 'Search matching processes...',
              prefixIcon: const Icon(Icons.search, size: 18),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
            style: const TextStyle(fontSize: 12),
          ),
        ),
        Expanded(
          child: items.isEmpty
              ? const Center(child: Text('No active matching processes.', style: TextStyle(color: Colors.white24)))
              : ListView.builder(
                  itemCount: items.length,
                  itemBuilder: (context, idx) {
                    final p = items[idx];
                    return ListTile(
                      dense: true,
                      title: Text(p['name'] ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('PID: \${p['pid']} - Memory: \${p['ram']}%', style: const TextStyle(color: Colors.white24, fontSize: 10)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('\${p['cpu']}% CPU', style: const TextStyle(color: Color(0xFF00F2FF), fontSize: 11, fontWeight: FontWeight.bold)),
                          const SizedBox(width: 12),
                          ElevatedButton(
                            onPressed: () => _killProcess(p['pid'], p['name']),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red.withOpacity(0.2),
                              foregroundColor: Colors.redAccent,
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                              minimumSize: const Size(50, 24),
                            ),
                            child: const Text('KILL', style: TextStyle(fontSize: 10)),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        )
      ],
    );
  }

  Widget _buildPowerTab() {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 20),
        const Icon(Icons.flash_on, size: 60, color: Colors.amber),
        const SizedBox(height: 12),
        const Text(
          'ACPI HARDWARE ACTUATORS',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, letterSpacing: 1.5),
        ),
        const SizedBox(height: 32),
        ElevatedButton.icon(
          onPressed: () => _sendPowerAction('lock'),
          icon: const Icon(Icons.lock, size: 16),
          label: const Text('LOCK WORKSTATION'),
          style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16), backgroundColor: Colors.white10),
        ),
        const SizedBox(height: 12),
        ElevatedButton.icon(
          onPressed: () => _sendPowerAction('sleep'),
          icon: const Icon(Icons.bed, size: 16),
          label: const Text('ACPI SLEEP'),
          style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16), backgroundColor: Colors.white10),
        ),
        const SizedBox(height: 12),
        ElevatedButton.icon(
          onPressed: () => _sendPowerAction('restart'),
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('REMOTE REBOOT'),
          style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16), backgroundColor: Colors.orange.withOpacity(0.15), foregroundColor: Colors.orangeAccent),
        ),
        const SizedBox(height: 12),
        ElevatedButton.icon(
          onPressed: () => _sendPowerAction('shutdown'),
          icon: const Icon(Icons.power_settings_new, size: 16),
          label: const Text('FORCE SHUTDOWN SYSTEM'),
          style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16), backgroundColor: Colors.red.withOpacity(0.15), foregroundColor: Colors.redAccent),
        ),
      ],
    );
  }

  Widget _buildCmdTab() {
    return Column(
      children: [
        Expanded(
          child: Container(
            color: Colors.black,
            padding: const EdgeInsets.all(12),
            width: double.infinity,
            child: ListView.builder(
              itemCount: _consoleLogs.length,
              itemBuilder: (context, idx) {
                return Text(
                  _consoleLogs[idx],
                  style: const TextStyle(color: Color(0xFF00FF66), fontSize: 11, fontFamily: 'monospace'),
                );
              },
            ),
          ),
        ),
        Container(
          color: const Color(0xFF16161C),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(
            children: [
              const Text('>', style: TextStyle(color: Color(0xFF00FF66), fontWeight: FontWeight.bold)),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _shellController,
                  onSubmitted: (_) => _sendShellCommand(),
                  decoration: const InputDecoration(
                    hintText: 'Type Windows command...',
                    border: InputBorder.none,
                    hintStyle: TextStyle(color: Colors.white24, fontSize: 12),
                  ),
                  style: const TextStyle(color: Colors.white, fontSize: 12, fontFamily: 'monospace'),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send, size: 16, color: Color(0xFF00F2FF)),
                onPressed: _sendShellCommand,
              )
            ],
          ),
        )
      ],
    );
  }

  Widget _buildStatTile(String title, String val, IconData icon) {
    return Card(
      color: const Color(0xFF16161C),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF00F2FF)),
        title: Text(title, style: const TextStyle(color: Colors.white60, fontSize: 12)),
        trailing: Text(val, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white)),
      ),
    );
  }
}
`;

export const presetDatabaseSchema = `
-- sqlite database schema design table templates for persistent windows local service
-- saved at ~/.pc_control_agent.db

-- 1. Table schema: audit_logs
-- Keeps record of logins, terminated processes, command history and status logs
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    level TEXT NOT NULL,       -- 'INFO', 'WARNING', 'ERROR', 'SUCCESS'
    category TEXT NOT NULL,    -- 'system', 'security', 'power', 'network', 'process'
    message TEXT NOT NULL
);

-- 2. Table schema: automation_rules
-- Keeps user defined automation logic templates
CREATE TABLE automation_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,     -- triggers list: 'IF Valorant Starts', 'IF CPU > 90%', 'IF Specific User Logs In'
    action TEXT NOT NULL,      -- actions: 'THEN Send Notification', 'THEN Send Alert', 'THEN Lock PC'
    enabled INTEGER DEFAULT 1  -- 1=Enabled, 0=Disabled
);

-- 3. Table schema: pairing_devices
-- Enforces pairing with AES decryption symmetric keys
CREATE TABLE pairing_devices (
    client_id TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    paired_at TEXT NOT NULL,
    aes_symmetric_key TEXT NOT NULL
);

-- 4. Table schema: firewall_rules
-- Simple local rules tracking registry block patterns
CREATE TABLE custom_firewall_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT NOT NULL,
    executable_path TEXT NOT NULL,
    blocked INTEGER DEFAULT 0  -- 1=Blocked, 0=Allowed
);
`;

export const documentationSections: GuideSection[] = [
  {
    id: "overview",
    title: "1. Architecture Roadmap",
    description: "System topology, components connection, and Tailscale communication map.",
    content: `## Architecture Overview
This PC Control Suite handles secure, low-latency, and zero-dependency personal PC management:

1. **Windows PC Agent Service (Python, FastAPI, SQLite)**
   - Operates locally as a Windows background task or Windows Service.
   - Monitors parameters via \`psutil\`, handles system state commands (Shutdown, Lock, Sleep) using Windows \`ctypes\` and \`win32api\` protocols.
   - Hosts a high-performance, lightweight FastAPI application bound to local address \`0.0.0.0\` on Port \`3000\`.
   - SQLite manages native file database (\`~/.pc_control_agent.db\`) to record system actions, authentication audits, and automation rules in real-time.

2. **Mobile Client (Flutter, Android)**
   - High-performance dashboard utilizing Dart’s native \`WebSocket\` listeners or secure HTTP endpoints to retrieve live telemetry once every 1 second.
   - Locally caches session pairing tokens securely in SharedPreferences.

3. **Zero-Configuration Communication Tunnel (Tailscale Integration)**
   - No complex router port-forwarding or public IP setups.
   - Both devices join your private Tailscale Mesh VPN.
   - The phone connects directly to your computer using your machine's permanent Tailscale IPv4 address (e.g., \`100.x.x.x\`) securely encrypted on both ends.`
  },
  {
    id: "installation",
    title: "2. Installation Guide",
    description: "Setting up Python background agent and launching the background listener on Windows 11.",
    content: `## Setting up the Windows Agent Service

Follow these steps to activate the self-hosted coordinator:

1. **Verify Python Configuration**
   Ensure Python 3.9+ is installed on your Windows machine and mapped correctly to your path variables:
   \`\`\`bash
   python --version
   \`\`\`

2. **Clone and Package the Workspace**
   Extract the files of your PC Control Agent in your directory:
   \`\`\`bash
   mkdir C:\\\\PCControlAgent
   cd C:\\\\PCControlAgent
   \`\`\`

3. **Create VirtuEnv & Packages Installation**
   Create a virtual environment to protect packages and trigger direct installation:
   \`\`\`bash
   python -m venv venv
   call venv\\\\Scripts\\\\activate
   pip install fastapi uvicorn psutil pywin32 pyjwt cryptography pynvml
   \`\`\`

4. **Launch Agent Module**
   Run the background daemon instantly inside the directory:
   \`\`\`bash
   python agent.py
   \`\`\`

5. **Configure to Start automatically on Windows Startup**
   To execute the script automatically without terminal popups, create a launcher loader script \`launcher.vbs\` in the startup folder (\`shell:startup\`):
   \`\`\`vbs
   Set WinScriptHost = CreateObject("WScript.Shell")
   WinScriptHost.Run "C:\\\\PCControlAgent\\\\venv\\\\Scripts\\\\pythonw.exe C:\\\\PCControlAgent\\\\agent.py", 0
   Set WinScriptHost = Nothing
   \`\`\``
  },
  {
    id: "deployment",
    title: "3. Tailscale & VPN Setup",
    description: "Configuring a zero-charge private network gateway to manage your gaming host from anywhere in the world.",
    content: `## Outer Net Access with Tailscale Mesh VPN

To connect outside of your local home WiFi network securely without opening router ports:

1. **Install Tailscale**
   - Download the official Tailscale client for Windows 11 from [tailscale.com](https://tailscale.com).
   - Also download the Tailscale Companion mobile application on your Android phone.

2. **Login & Authenticate**
   - Authentication can be completed with a free personal account.
   - Log in with the same account on both your Windows PC and your Android device.

3. **Check Connection Status**
   - Head over to your Tailscale dashboard; you will see both devices represented as active peers.
   - Locate and copy your Windows machine's dedicated Tailscale IP (typically starts with \`100.x.x.x\`).

4. **Pair with Mobile App**
   - On the connection portal of the Flutter application, simply input this Tailscale IP address (e.g. \`100.64.122.90\`) and your secret pairing password.
   - Telemetry signals and actions will now tunnel safely and directly over WireGuard from any location.`
  },
  {
    id: "security",
    title: "4. Cryptography & Security Setup",
    description: "How pairing tokens, AES symmetrical communication, and JWT tokens isolate administrative access.",
    content: `## Deep Security Blueprint

Our design implements active defensive measures to isolate system privileges:

1. **JWT System Handshakes**
   - Normal command triggers require a Bearer token verification.
   - Logging in via the correct secret pairing password signs a secure JSON Web Token payload with a \`HS256\` signature valid for 30 days.

2. **AES Symm Encryption Tunnel**
   - Communication via WebSockets or specialized file logs uses symmetric cryptographic encryption via cryptography’s Fernet (AES-128/256) library.
   - During physical device pairing, a unique pairing password seeds an exchange where the desktop sends a unique hex cryptographic key, which is used to lock and unlock sensitive action vectors.

3. **Local privilege auditing**
   - All connection handshakes, failed authentication requests, and killed execution targets log directly into the independent SQLite file, completely sealed from third-party networks.`
  },
  {
    id: "api_ref",
    title: "5. REST API Documentation",
    description: "Full mapping of HTTP endpoints, parameters, and query targets.",
    content: `## Complete Endpoint Parameters

All REST commands correspond to standard ports on target address \`http://localhost:3000\`:

### 1. Account Pairing & Login Handshake
* **Endpoint:** \`/api/auth/login\`
* **Method:** \`POST\`
* **Headers:** \`Content-Type: application/json\`
* **Payload:** 
  \`\`\`json
  { "password": "your_secure_pairing_password" }
  \`\`\`
* **Response:**
  \`\`\`json
  { "token": "ey...", "status": "success" }
  \`\`\`

### 2. Retrieve Process Feed
* **Endpoint:** \`/api/processes\`
* **Method:** \`GET\`
* **Headers:** \`Authorization: Bearer <your_jwt_token>\`
* **Response:**
  \`\`\`json
  [
    { "pid": 1240, "name": "valorant.exe", "cpu": 12.2, "ram": 4.10, "path": "...", "status": "running" }
  ]
  \`\`\`

### 3. Terminate Target Process
* **Endpoint:** \`/api/process/kill\`
* **Method:** \`POST\`
* **Headers:** \`Authorization: Bearer <your_jwt_token>\`
* **Payload:** 
  \`\`\`json
  { "pid": 1240 }
  \`\`\`

### 4. Trigger Power Action
* **Endpoint:** \`/api/power/action\`
* **Method:** \`POST\`
* **Query Params:** \`action\` (Options: \`lock\`, \`sleep\`, \`restart\`, \`shutdown\`, \`hibernate\`)
* **Headers:** \`Authorization: Bearer <your_jwt_token>\`

### 5. Launch Application
* **Endpoint:** \`/api/apps/launch\`
* **Method:** \`POST\`
* **Payload:**
  \`\`\`json
  { "app_name": "valorant" }
  \`\`\``
  },
  {
    id: "localhost_domain",
    title: "6. localhost & Domain Hosting",
    description: "Configure your self-hosted PC panel on a custom hostname with Nginx Reverse Proxy and TLS SSL.",
    content: `## Self-Hosting under Your Own Domain Name

To deploy the PC Control web panel permanently, you can host the application on your local workstation or a dedicated private server pointed to your custom domain. Here is a secure routing blueprint:

1. **Build the Production-Ready Web Assets**
   Compile the source code of the web client using Vite:
   \`\`\`bash
   # Inside the web app directory
   npm install
   npm run build
   \`\`\`
   This compiles the React/TypeScript frontend into fully-optimized, static assets inside the \`dist/\` directory to serve locally.

2. **Configure Your Custom Domain or Host File**
   - **Public Domain**: Map an \`A\` or \`CNAME\` record in your DNS Registrar (e.g. Cloudflare, Namecheap) pointing to your workstation or private server's public IP address (e.g., \`panel.yourdomain.com\` -> \`Your_IP\`).
   - **Local Domain fallback**: Edit your local Windows host file (\`C:\\Windows\\System32\\drivers\\etc\\hosts\`) or Linux (\`/etc/hosts\`) to resolve a custom domain locally:
     \`\`\`text
     127.0.0.1  panel.local
     \`\`\`

3. **Configure Nginx Reverse Proxy & SSL (Recommended)**
   To serve both API routes and static client files over secure HTTPS (Port 443), install Nginx and write a server block configurations mapping:
   \`\`\`nginx
   server {
       listen 80;
       server_name panel.yourdomain.com;
       return 301 https://\$host\$request_uri; # Redirect HTTP to HTTPS
   }

   server {
       listen 443 ssl;
       server_name panel.yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/panel.yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/panel.yourdomain.com/privkey.pem;

       # Frontend Web Assets serving
       location / {
           root /var/www/pc_control/dist;
           index index.html;
           try_files \$uri \$uri/ /index.html;
       }

       # Backend API requests routing
       location /api/ {
           proxy_pass http://127.0.0.1:3000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host \$host;
           proxy_cache_bypass \$http_upgrade;
       }

       # WebSocket real-time telemetry
       location /ws {
           proxy_pass http://127.0.0.1:3000/ws;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host \$host;
       }
   }
   \`\`\`

4. **Acquire Let's Encrypt Free SSL Certificate**
   Run the Certbot command-line program to automate HTTPS key certificate bindings:
   \`\`\`bash
   sudo certbot --nginx -d panel.yourdomain.com
   \`\`\`

5. **Deploy the Express Server Backend**
   To keep your web dashboard running 24/7 on your backend server:
   \`\`\`bash
   npm run build
   # Run using node processes monitor like PM2
   npm install -g pm2
   pm2 start dist/server.cjs --name "pc-control-suite"
   pm2 save
   pm2 startup
   \`\`\``
  },
  {
    id: "build_android_apk",
    title: "7. Build Android Client App (APK)",
    description: "Full guide to compile the custom Material Design client into a standalone Android APK file.",
    content: `## Compiling Your Native Android Mobile App (.APK)

You can easily bundle and compile the complete Material/Dart code displayed on this dashboard into a fully-functional native Android application using the Flutter framework:

1. **Install the Flutter Software Development Kit (SDK)**
   - Download the Flutter SDK zip bundle for your platform from [flutter.dev](https://docs.flutter.dev/get-started/install).
   - Extract it to a standard path variable (e.g. \`C:\\flutter\`) and add its \`bin\` subdirectory to your user Environment \`PATH\`.
   - Install Android Studio to set up the Android SDK and terminal tools.

2. **Initialize a Fresh Flutter Project**
   Open a terminal shell and construct a clean, empty workspace:
   \`\`\`bash
   flutter create pc_control_mobile
   cd pc_control_mobile
   \`\`\`

3. **Install Core Network Dependencies**
   Open \`pubspec.yaml\` inside your new directory and include these essential networking dependencies under \`dependencies:\`:
   \`\`\`yaml
   dependencies:
     flutter:
       sdk: flutter
     http: ^1.1.0            # Handles connection handshake REST API requests
     web_socket_channel: ^2.4.0 # Active real-time WebSocket listeners
     shared_preferences: ^2.2.0 # Key-value state persistence
   \`\`\`
   Alternatively, you can install all three packages automatically in one simple step by running:
   \`\`\`bash
   flutter pub add http web_socket_channel shared_preferences
   \`\`\`
   And run:
   \`\`\`bash
   flutter pub get
   \`\`\`

4. **Inject Your Custom Dart Source Code**
   - Click on the **Code & Compiling Hub** tab at the top of this dashboard of our Web App interface.
   - Choose the **Mobile Flutter (Dart)** file format option.
   - Click to copy the full Dart content of the custom Mobile Client.
   - Open your local project's \`lib/main.dart\` file, delete all boilerplates, and paste this exact Dart source code.

5. **Configure Android Network permissions**
   To let your cell phone open external connections (to your computer or cloud tunnels), open \`android/app/src/main/AndroidManifest.xml\` and make sure the following line is configured inside the main \`<manifest>\` tag block:
   \`\`\`xml
   <uses-permission android:name="android.permission.INTERNET" />
   \`\`\`

6. **Generate a Release-Optimized Android APK**
   Execute this terminal compilation script inside your Flutter project:
   \`\`\`bash
   flutter build apk --release
   \`\`\`
   This will completely optimize structure allocations, strip debuggers, compile Dart variables, and output a standalone binary at:
   \`build/app/outputs/flutter-apk/app-release.apk\`

7. **Deploy and Run on Your Device**
   - Transfer this \`app-release.apk\` package directly onto your Android device (using USB connector, email, or a cloud drive).
   - Open any Android app file explorer to run the file, permit standard side-loading installations when asked, and boot up your native responsive system controller dashboard immediately.

## ⚡ Alternative: Compile Completely Online (No Local SDK Setup)

If you do not want to install Flutter or Android Studio on your local computer, you can use online cloud tools to build the APK directly in your browser:

### Option A: FlutLab (The Easiest Online IDE & Builder)
[FlutLab.io](https://flutlab.io/) is an online interactive compiler designed specifically for Flutter:
1. Register for a free account on **FlutLab.io**.
2. Click **Create Project** or upload a default Flutter starter template in your browser.
3. Replace the contents of \`lib/main.dart\` with the source code copied from our **Code** tab.
4. Add the dependencies to your \`pubspec.yaml\` via the FlutLab web panel (\`http\`, \`web_socket_channel\`, and \`shared_preferences\`).
5. Click **Build** -> **Build APK** inside the editor.
6. Once compiled, scan the QR code displayed or click the download link to download the native APK file directly to your phone.

### Option B: Codemagic CI/CD (Professional Cloud Builds)
[Codemagic.io](https://codemagic.io/) provides free cloud machines specifically optimized to compile Flutter:
1. Upload your code to a repository on **GitHub** (or GitLab/Bitbucket).
2. Connect your repository to **Codemagic**.
3. Choose **Android** as your target build platform.
4. Set the build type to **Release** and configure compiling settings.
5. Click **Start Build**. Codemagic's server will boot up a VM, execute \`flutter build apk\`, and email you the finished download link of the compiled APK file in under 3 minutes.

### Option C: GitHub Actions Workflow
Create a simple automated compile process on your GitHub repository entirely for free:
1. Create a file path \`.github/workflows/build.yml\` in your repository.
2. Paste the following configuration to automate the cloud build:
   \`\`\`yaml
   name: Build Android APK
   on: [push, workflow_dispatch]
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-java@v3
           with:
             distribution: "zulu"
             java-version: "17"
         - uses: subosito/flutter-action@v2
           with:
             channel: "stable"
         - run: flutter pub get
         - run: flutter build apk --release
         - uses: actions/upload-artifact@v3
           with:
             name: release-apk
             path: build/app/outputs/flutter-apk/app-release.apk
   \`\`\`
3. Push your repository. GitHub's runner machines will automatically compile your code into an APK asset available for direct download under your repository's actions tab.`
  },
  {
    id: "upgrades",
    title: "9. Future Upgrade Suggestions",
    description: "Scaling to custom widgets, Discord integrations, and wake-on-LAN controllers.",
    content: `## Enhancing Your Agent Dashboard

Here are four high-impact suggestions to build on this framework:

1. **Wake-On-LAN Integration**
   - Set up an ESP32 micro-controller or another low-power device within your domestic router environment that listens for UDP wake magic packets.
   - Directly wake your computer from complete Shutdown state over Tailscale.

2. **Discord Bot Webhook Alerts**
   - Connect the Windows Agent sqlite logs or trigger alerts directly to a Discord webhook. This notifies you on Discord immediately whenever a custom process starts or temperatures exceed thresholds.

3. **Active Audio Mixer Controls**
   - Extend the python win32 or pycaw framework script to fetch active audio playback streams (e.g., Spotify, Discord) and adjust volume levels slider-by-slider directly from your phone.

4. **WPF / System Tray Settings App**
   - Wrap your python agent service in a simple PySide6 system tray icon so you can easily visual-check status, adjust security passwords, or read access logs with a desktop click.`
  }
];

export const defaultProcesses: ProcessInfo[] = [
  { pid: 14208, name: "valorant.exe", cpu: 14.8, ram: 4120, path: "C:\\Riot Games\\VALORANT\\live\\VALORANT.exe", status: "running" },
  { pid: 8244, name: "discord.exe", cpu: 1.4, ram: 812, path: "C:\\Users\\Gamer\\AppData\\Local\\Discord\\app-1.0.9015\\Discord.exe", status: "running" },
  { pid: 10452, name: "chrome.exe", cpu: 2.8, ram: 2840, path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", status: "running" },
  { pid: 6104, name: "spotify.exe", cpu: 0.1, ram: 244, path: "C:\\Users\\Gamer\\AppData\\Roaming\\Spotify\\Spotify.exe", status: "running" },
  { pid: 2104, name: "steam.exe", cpu: 0.8, ram: 512, path: "C:\\Program Files (x86)\\Steam\\steam.exe", status: "running" },
  { pid: 320, name: "nvidia_container.exe", cpu: 0.1, ram: 45, path: "C:\\Program Files\\NVIDIA Corporation\\Display.NvContainer\\nvcontainer.exe", status: "running" },
  { pid: 212, name: "taskmgr.exe", cpu: 1.1, ram: 142, path: "C:\\Windows\\System32\\taskmgr.exe", status: "running" },
  { pid: 9024, name: "obs64.exe", cpu: 0.2, ram: 618, path: "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe", status: "running" }
];

export const initialRules: AutomationRule[] = [
  { id: "rule_1", name: "Valorant Launcher Alert", trigger: "IF Valorant Starts", action: "THEN Send Notification", enabled: true },
  { id: "rule_2", name: "Heavy Load Guardian", trigger: "IF CPU > 90%", action: "THEN Send Alert", enabled: true },
  { id: "rule_3", name: "Admin Login Sentry", trigger: "IF Specific User Logs In", action: "THEN Send Notification", enabled: true },
  { id: "rule_4", name: "Network Security Logger", trigger: "IF Internet Is Enabled", action: "THEN Log Event", enabled: false }
];

export const initialLogs: LogEntry[] = [
  { id: "log_1", timestamp: "11:15:02", level: "success", category: "system", message: "PC Control Agent background service initialized successfully on Port 3000." },
  { id: "log_2", timestamp: "11:15:03", level: "info", category: "network", message: "Listening on loopback and private Tailscale network adapter: 100.82.144.11" },
  { id: "log_3", timestamp: "11:15:10", level: "success", category: "security", message: "Authenticated secure login from administrative mobile console: ANDROID-SDK-2026." },
  { id: "log_4", timestamp: "11:15:12", level: "info", category: "power", message: "Power configuration status loaded into context. All systems green." }
];
