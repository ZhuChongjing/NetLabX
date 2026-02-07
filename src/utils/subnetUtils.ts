/**
 * 子网掩码工具函数
 *
 * 用于子网计算、校验和IP地址匹配
 */

/**
 * 计算子网地址
 * @param ip IP地址（如 192.168.1.10）
 * @param subnetMask 子网掩码（如 255.255.255.0）
 * @returns 子网地址（如 192.168.1.0）
 */
export function calculateSubnet(ip: string, subnetMask: string = '255.255.255.0'): string {
  try {
    const ipParts = ip.split('.').map(Number);
    const maskParts = subnetMask.split('.').map(Number);

    if (ipParts.length !== 4 || maskParts.length !== 4) {
      return '';
    }

    const subnetParts = ipParts.map((octet, i) => octet & maskParts[i]);
    return subnetParts.join('.');
  } catch (error) {
    console.error('计算子网地址失败:', error);
    return '';
  }
}

/**
 * 判断两个IP是否在同一子网
 * @param ip1 第一个IP地址
 * @param subnetMask 子网掩码
 * @param ip2 第二个IP地址
 * @returns 是否在同一子网
 */
export function isInSameSubnet(
  ip1: string,
  subnetMask: string = '255.255.255.0',
  ip2: string
): boolean {
  const subnet1 = calculateSubnet(ip1, subnetMask);
  const subnet2 = calculateSubnet(ip2, subnetMask);

  if (!subnet1 || !subnet2) {
    return false;
  }

  return subnet1 === subnet2;
}

/**
 * 验证子网掩码格式是否有效
 * @param mask 子网掩码
 * @returns 是否有效
 */
export function isValidSubnetMask(mask: string): boolean {
  const parts = mask.split('.').map(Number);

  if (parts.length !== 4) {
    return false;
  }

  // 检查每个部分是否在 0-255 范围内
  if (parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  // 常见的有效子网掩码（初中教学常用）
  const validMasks = [
    '255.255.255.0',   // /24 - C类网络（最常用）
    '255.255.0.0',     // /16 - B类网络
    '255.0.0.0',       // /8 - A类网络
    '255.255.255.128', // /25
    '255.255.255.192', // /26
    '255.255.255.224', // /27
    '255.255.255.240', // /28
    '255.255.255.248', // /29
    '255.255.255.252', // /30
  ];

  return validMasks.includes(mask);
}

/**
 * 将子网掩码转换为CIDR前缀长度
 * @param mask 子网掩码（如 255.255.255.0）
 * @returns CIDR前缀（如 24）
 */
export function maskToCIDR(mask: string): number {
  const parts = mask.split('.').map(Number);

  let cidr = 0;
  for (const part of parts) {
    cidr += part.toString(2).split('1').length - 1;
  }

  return cidr;
}

/**
 * 将CIDR前缀长度转换为子网掩码
 * @param cidr CIDR前缀（如 24）
 * @returns 子网掩码（如 255.255.255.0）
 */
export function cidrToMask(cidr: number): string {
  const mask = [];

  for (let i = 0; i < 4; i++) {
    const bits = Math.min(8, Math.max(0, cidr - i * 8));
    mask.push(256 - Math.pow(2, 8 - bits));
  }

  return mask.join('.');
}
