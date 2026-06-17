export interface CodeTemplate {
  id: string;
  filename: string;
  language: string;
  description: string;
  content: string;
}

export interface GuideSection {
  id: string;
  title: string;
  description: string;
  content: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  ram: number; // in MB
  path: string;
  status: 'running' | 'suspended';
  favorite?: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string; // e.g. "IF Valorant Starts"
  action: string;  // e.g. "THEN Send Notification"
  enabled: boolean;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'system' | 'security' | 'power' | 'network' | 'process';
  message: string;
}

export interface SystemStats {
  cpuUsage: number;
  cpuTemp: number;
  ramUsage: number;
  ramTotal: number;
  gpuUsage: number;
  gpuTemp: number;
  diskUsage: number;
  netUpload: number; // KB/s
  netDownload: number; // KB/s
  uptime: string;
  currentUser: string;
  internetConnected: boolean;
}
