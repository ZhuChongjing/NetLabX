/**
 * IP地址验证工具函数
 */

/**
 * 验证IP地址格式和范围
 * @param ip IP地址字符串
 * @returns { valid: boolean, error?: string }
 */
export function validateIPAddress(ip: string): { valid: boolean; error?: string } {
  // 空字符串检查
  if (!ip || ip.trim() === '') {
    return { valid: false, error: 'IP地址不能为空' };
  }

  // 格式检查：必须是 x.x.x.x 格式
  const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipPattern);

  if (!match) {
    return { valid: false, error: 'IP地址格式错误，应由4个0-255的十进制数字组成（如 192.168.1.1）' };
  }

  // 提取四个数字段
  const segments = [
    parseInt(match[1]),
    parseInt(match[2]),
    parseInt(match[3]),
    parseInt(match[4])
  ];

  // 范围检查：每段必须在 0-255 之间
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment < 0 || segment > 255) {
      return {
        valid: false,
        error: `IP地址第${i + 1}段（${segment}）超出范围，必须在 0-255 之间`
      };
    }
  }

  // 特殊IP检查（真实主机IP不能以0开头）
  // 0.0.0.0是特殊地址（表示"所有地址"或"本机"），一般不用于设备IP
  if (segments[0] === 0) {
    return { valid: false, error: '真实设备IP不能以0开头（0.0.0.0是特殊地址，表示"所有地址"）' };
  }

  if (segments[0] === 127) {
    return { valid: false, error: '保留的回环地址（127.x.x.x用于本机测试），请使用其他IP段' };
  }

  if (segments[0] === 255) {
    return { valid: false, error: '无效的IP地址（255开头为广播地址）' };
  }

  // C类教学场景下：最后一段0通常为网段地址，255为广播地址
  if (segments[3] === 0) {
    return { valid: false, error: 'IP地址的最后一段不能为0（如 192.168.1.0 是网段地址，不能分配给设备）' };
  }

  if (segments[3] === 255) {
    return { valid: false, error: 'IP地址的最后一段不能为255（如 192.168.1.255 是广播地址，不能分配给设备）' };
  }

  return { valid: true };
}

/**
 * 实时IP输入验证（输入过程中的提示）
 * @param ip 当前输入的IP
 * @returns { warning?: string } 警告信息（不阻止输入）
 */
export function validateIPInput(ip: string): { warning?: string } {
  if (!ip || ip.trim() === '') {
    return {};
  }

  // 检查是否包含非法字符
  if (!/^[\d.]*$/.test(ip)) {
    return { warning: '只能输入数字和点号' };
  }

  // 检查点号数量
  const dots = (ip.match(/\./g) || []).length;
  if (dots > 3) {
    return { warning: 'IP地址只能包含3个点号' };
  }

  // 检查是否有连续的点号
  if (/\.{2,}/.test(ip)) {
    return { warning: '不能有连续的点号' };
  }

  // 检查每段数字
  const segments = ip.split('.');
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg === '') continue; // 允许输入中的空段

    const num = parseInt(seg);
    if (num > 255) {
      return { warning: `第${i + 1}段（${num}）超过255` };
    }
  }

  return {};
}
