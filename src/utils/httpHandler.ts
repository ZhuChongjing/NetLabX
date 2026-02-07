import { Device, HTTPRequest, HTTPResponse, DNSQuery, DNSQueryResult } from '../types';
import { DNSResolver } from './dnsResolver';

/**
 * HTTP请求处理器
 * 模拟浏览器发送HTTP请求访问网站的过程
 */
export class HTTPHandler {
  private devices: Device[];
  private dnsResolver: DNSResolver;

  constructor(devices: Device[]) {
    this.devices = devices;
    this.dnsResolver = new DNSResolver(devices);
  }

  /**
   * 判断输入是否为IP地址
   */
  private static isIPAddress(input: string): boolean {
    // 匹配IPv4地址格式
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = input.match(ipPattern);

    if (!match) return false;

    // 验证每个段是否在0-255范围内
    for (let i = 1; i <= 4; i++) {
      const num = parseInt(match[i]);
      if (num < 0 || num > 255) return false;
    }

    return true;
  }

  /**
   * 处理HTTP请求（域名访问，需要DNS解析）
   * @param request HTTP请求
   * @param dnsServerIP DNS服务器IP（用于域名解析）
   * @returns HTTP响应
   */
  handleRequest(
    request: HTTPRequest,
    dnsServerIP: string
  ): {
    response: HTTPResponse;
    dnsResult?: DNSQueryResult;
  } {
    // 1. DNS解析域名
    const dnsQuery: DNSQuery = {
      domain: request.domain,
      sourceIP: request.sourceIP,
      dnsServerIP: dnsServerIP,
    };

    const dnsResult = this.dnsResolver.resolveDomain(dnsQuery);

    if (!dnsResult.success || !dnsResult.resolvedIP) {
      return {
        response: {
          success: false,
          statusCode: 404,
          message: `❌ DNS解析失败：${dnsResult.message}`,
        },
        dnsResult,
      };
    }

    // 2. 使用解析出的IP处理HTTP请求
    const response = this.validateAndFetchWebServer(dnsResult.resolvedIP, request.port || 80, request.domain);

    return {
      response,
      dnsResult,
    };
  }

  /**
   * 处理HTTP请求（IP直接访问，跳过DNS解析）
   * @param request HTTP请求（targetIP必须是有效的IP地址）
   * @returns HTTP响应
   */
  handleDirectIPRequest(request: HTTPRequest): HTTPResponse {
    // 1. 验证targetIP是否为有效IP
    if (!request.targetIP || !HTTPHandler.isIPAddress(request.targetIP)) {
      return {
        success: false,
        statusCode: 400,
        message: `❌ 无效的IP地址：${request.targetIP}`,
      };
    }

    // 2. 使用IP直接处理HTTP请求
    return this.validateAndFetchWebServer(request.targetIP, request.port || 80, request.targetIP);
  }

  /**
   * 验证Web服务器并获取响应（公共逻辑）
   * @param targetIP 目标IP地址
   * @param requestPort 请求端口
   * @param displayName 显示名称（域名或IP）
   * @returns HTTP响应
   */
  private validateAndFetchWebServer(
    targetIP: string,
    requestPort: number,
    displayName: string
  ): HTTPResponse {
    // 1. 查找Web服务器
    const webServer = this.devices.find(
      (d) => d.type === 'web' && d.ip === targetIP
    );

    if (!webServer) {
      // ✅ 优化：区分"IP不存在"和"IP存在但不是Web服务器"
      const existingDevice = this.devices.find((d) => d.ip === targetIP);

      if (!existingDevice) {
        // IP地址在网络中不存在
        return {
          success: false,
          statusCode: 404,
          message: `❌ 目标主机不可达\n\nIP地址 ${targetIP} 在网络中不存在\n\n💡 类似 Ping 提示：请求超时 (Request timeout)`,
        };
      } else {
        // IP存在，但不是Web服务器
        const deviceTypeMap: Record<string, string> = {
          'pc': 'PC',
          'dns': 'DNS服务器',
          'router': '路由器',
        };
        const deviceTypeName = deviceTypeMap[existingDevice.type] || existingDevice.type;

        return {
          success: false,
          statusCode: 503,
          message: `❌ 目标IP ${targetIP} 不是Web服务器\n\n该设备是 ${existingDevice.name} (${deviceTypeName})，无法响应HTTP请求\n\n💡 请确认访问的是Web服务器`,
        };
      }
    }

    // 2. 检查端口是否匹配
    const serverPort = webServer.port || 80; // 服务器默认端口80

    if (requestPort !== serverPort) {
      return {
        success: false,
        statusCode: 503,
        message: `❌ 端口错误：服务器 ${webServer.name} 监听在端口 ${serverPort}，但请求访问端口 ${requestPort}\n\n💡 解决方法：\n1. 修改URL端口为 :${serverPort}\n2. 或修改Web服务器监听端口为 ${requestPort}`,
      };
    }

    // 3. 检查Web服务器是否配置了网页内容
    if (!webServer.webContent || webServer.webContent.trim() === '') {
      return {
        success: false,
        statusCode: 204,
        message: `⚠️ Web服务器 ${webServer.name} 没有配置网页内容`,
      };
    }

    // 4. 返回成功响应
    return {
      success: true,
      statusCode: 200,
      content: webServer.webContent,
      message: `✅ HTTP 200 OK - 成功访问 ${displayName}`,
    };
  }

  /**
   * 判断输入是否为IP地址（对外暴露）
   */
  static checkIsIPAddress(input: string): boolean {
    return HTTPHandler.isIPAddress(input);
  }

  /**
   * 获取所有Web服务器
   */
  getWebServers(): Device[] {
    return this.devices.filter((d) => d.type === 'web');
  }

  /**
   * 根据域名查找Web服务器
   */
  findWebServerByDomain(domain: string): Device | undefined {
    return this.devices.find(
      (d) => d.type === 'web' && d.domain?.toLowerCase() === domain.toLowerCase()
    );
  }

  /**
   * 生成HTTP请求日志
   */
  static formatRequestLog(request: HTTPRequest): string {
    return [
      `${request.method} ${request.url} HTTP/1.1`,
      `Host: ${request.domain}`,
      `User-Agent: NetworkSimulator/1.0`,
      `Accept: text/html`,
      `Connection: keep-alive`,
      '',
    ].join('\n');
  }

  /**
   * 生成HTTP响应日志
   */
  static formatResponseLog(response: HTTPResponse): string {
    const statusMessages: { [key: number]: string } = {
      200: 'OK',
      204: 'No Content',
      404: 'Not Found',
      503: 'Service Unavailable',
    };

    const lines = [
      `HTTP/1.1 ${response.statusCode} ${statusMessages[response.statusCode] || 'Unknown'}`,
      `Content-Type: text/html; charset=utf-8`,
      `Server: NetworkSimulator/1.0`,
      `Connection: keep-alive`,
      '',
    ];

    if (response.content) {
      lines.push(response.content);
    }

    return lines.join('\n');
  }
}
