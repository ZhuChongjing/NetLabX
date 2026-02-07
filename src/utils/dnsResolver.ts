import { Device, DNSQuery, DNSQueryResult } from '../types';

/**
 * DNS解析器
 * 模拟DNS服务器域名解析过程
 */
export class DNSResolver {
  private devices: Device[];

  constructor(devices: Device[]) {
    this.devices = devices;
  }

  /**
   * 查询域名对应的IP地址
   * @param query DNS查询请求
   * @returns DNS查询结果
   */
  resolveDomain(query: DNSQuery): DNSQueryResult {
    const steps: Array<{ action: string; details: string }> = [];

    // 1. 查找DNS服务器
    const dnsServer = this.devices.find(
      (d) => d.type === 'dns' && d.ip === query.dnsServerIP
    );

    if (!dnsServer) {
      return {
        success: false,
        domain: query.domain,
        message: `❌ DNS服务器 ${query.dnsServerIP} 不存在`,
        steps: [
          {
            action: '查找DNS服务器',
            details: `DNS服务器 ${query.dnsServerIP} 未找到`,
          },
        ],
      };
    }

    steps.push({
      action: '📡 发送DNS查询',
      details: `${query.sourceIP} → ${query.dnsServerIP}: 查询域名 ${query.domain}`,
    });

    // 2. 检查DNS记录
    if (!dnsServer.dnsRecords || dnsServer.dnsRecords.length === 0) {
      steps.push({
        action: '🔍 查询DNS记录',
        details: `DNS服务器 ${dnsServer.name} 没有配置任何DNS记录`,
      });

      return {
        success: false,
        domain: query.domain,
        message: `❌ DNS服务器 ${dnsServer.name} 没有配置DNS记录`,
        steps,
      };
    }

    // 3. 查找匹配的DNS记录
    const record = dnsServer.dnsRecords.find(
      (r) => r.domain.toLowerCase() === query.domain.toLowerCase()
    );

    if (!record) {
      steps.push({
        action: '🔍 查询DNS记录',
        details: `在 ${dnsServer.name} 的 ${dnsServer.dnsRecords.length} 条记录中未找到 ${query.domain}`,
      });

      return {
        success: false,
        domain: query.domain,
        message: `❌ 域名 ${query.domain} 未在DNS服务器中注册`,
        steps,
      };
    }

    steps.push({
      action: '✅ 找到DNS记录',
      details: `${record.domain} → ${record.ip} (${record.type}记录)`,
    });

    // 4. 验证目标IP对应的设备是否存在
    const targetDevice = this.devices.find((d) => d.ip === record.ip);

    if (!targetDevice) {
      steps.push({
        action: '⚠️ 验证目标设备',
        details: `DNS记录指向 ${record.ip}，但该IP不存在`,
      });

      return {
        success: false,
        domain: query.domain,
        resolvedIP: record.ip,
        message: `⚠️ DNS解析成功，但目标IP ${record.ip} 不存在`,
        steps,
      };
    }

    steps.push({
      action: '🎯 返回解析结果',
      details: `${query.domain} → ${record.ip} (设备: ${targetDevice.name})`,
    });

    return {
      success: true,
      domain: query.domain,
      resolvedIP: record.ip,
      message: `✅ 域名解析成功：${query.domain} → ${record.ip}`,
      steps,
    };
  }

  /**
   * 验证域名格式
   */
  static validateDomain(domain: string): boolean {
    // 简单的域名格式验证
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  }

  /**
   * 验证IP地址格式
   */
  static validateIP(ip: string): boolean {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * 获取所有DNS服务器
   */
  getDNSServers(): Device[] {
    return this.devices.filter((d) => d.type === 'dns');
  }

  /**
   * 查找包含指定域名记录的DNS服务器
   */
  findDNSServerByDomain(domain: string): Device | undefined {
    return this.devices.find(
      (d) =>
        d.type === 'dns' &&
        d.dnsRecords &&
        d.dnsRecords.some((r) => r.domain.toLowerCase() === domain.toLowerCase())
    );
  }
}
