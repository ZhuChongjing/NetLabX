// 网络设备类型定义

export type DeviceType = 'router' | 'pc' | 'server' | 'dns' | 'web';

export interface NetworkInterface {
  id?: string;
  name: string;
  ip: string;
  subnet?: string; // 网段地址（如 192.168.1.0）
  subnetMask?: string; // 子网掩码（如 255.255.255.0）
  connectedTo?: string; // 连接的设备ID
}

export interface RouteEntry {
  destination: string;  // 目标网络 "192.168.20.0"
  nextHop: string;      // 下一站路由器名称 "R2"
  metric: number;       // 权重/跳数
  interface: string;    // 出接口名称
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  ip: string;
  interfaces: NetworkInterface[];
  routingTable?: RouteEntry[];
  position: { x: number; y: number };
  // PC/DNS/Web服务器专用字段
  gateway?: string; // 默认网关IP地址
  dnsServer?: string; // DNS服务器IP地址
  // DNS服务器专用字段
  dnsRecords?: DNSRecord[];
  // Web服务器专用字段
  webContent?: string;
  domain?: string;
  port?: number;
}

export interface Connection {
  id: string;
  source: string;
  target: string;
  sourceInterfaceId?: string;
  targetInterfaceId?: string;
}

export interface IPPacket {
  sourceIP: string;
  destinationIP: string;
  data: string;
  ttl: number;
  currentPath: string[]; // 记录经过的路由器
}

export interface SimulationResult {
  success: boolean;
  path: string[];
  message: string;
  steps: Array<{
    router: string;
    action: string;
    routeEntry?: RouteEntry;
  }>;
  // 双向通信动画支持
  isRoundTrip?: boolean; // 是否是往返通信
  requestPath?: string[]; // 请求路径
  responsePath?: string[]; // 响应路径
  requestLabel?: string; // 请求标签（如"DNS查询: www.school.com"）
  responseLabel?: string; // 响应标签（如"返回IP: 192.168.2.50"）
  // HTTP请求状态
  httpSuccess?: boolean; // HTTP请求是否成功
  httpStatusCode?: number; // HTTP状态码（200, 404, 503等）
}

// 动画相关类型
export interface PacketAnimation {
  id: string;
  packet: IPPacket;
  currentIndex: number;
  path: string[];
  isAnimating: boolean;
}

// 编辑模式
export type EditMode = 'view' | 'edit-device' | 'edit-routing' | 'add-device';

// DNS记录
export interface DNSRecord {
  id: string;
  domain: string;
  ip: string;
  type: 'A'; // DNS记录类型(仅支持A记录)
}

// DNS查询请求
export interface DNSQuery {
  domain: string;
  sourceIP: string;
  dnsServerIP: string;
}

// DNS查询结果
export interface DNSQueryResult {
  success: boolean;
  domain: string;
  resolvedIP?: string;
  message: string;
  steps: Array<{
    action: string;
    details: string;
  }>;
}

// HTTP请求
export interface HTTPRequest {
  method: 'GET' | 'POST';
  url: string;
  domain: string;
  sourceIP: string;
  targetIP: string;
  port?: number; // 目标端口，默认80
}

// HTTP响应
export interface HTTPResponse {
  success: boolean;
  statusCode: number;
  content?: string;
  message: string;
}

// 考试题目
export interface ExamQuestion {
  id: string;
  title: string;
  description: string;
  requirements: {
    devices: Array<{ type: DeviceType; count: number; names?: string[] }>;
    connections: string[];
    routes?: string[];
    dnsRecords?: Array<{ domain: string; ip: string }>;
    webServers?: Array<{ domain: string; content: string }>;
    tests: Array<{ type: 'ping' | 'dns' | 'http'; params: any }>;
  };
  scoring: {
    topology: number;
    routing: number;
    dns: number;
    web: number;
    connectivity: number;
  };
  timeLimit: number; // 分钟
}

// 学生提交
export interface StudentSubmission {
  studentInfo: {
    name: string;
    studentId: string;
    class: string;
  };
  questionId: string;
  submittedAt: string;
  config: {
    devices: Device[];
    connections: Connection[];
  };
}

// 评分结果
export interface GradingResult {
  studentInfo: StudentSubmission['studentInfo'];
  questionId: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  details: {
    topology: { score: number; maxScore: number; errors: string[] };
    routing: { score: number; maxScore: number; errors: string[] };
    dns: { score: number; maxScore: number; errors: string[] };
    web: { score: number; maxScore: number; errors: string[] };
    connectivity: { score: number; maxScore: number; errors: string[] };
  };
  feedback: string;
  gradedAt: string;
}
