import React from 'react';
import { Device, NetworkInterface } from '../types';
import { useNetworkStore } from '../store/useNetworkStore';

interface InterfaceManagerProps {
  device: Device;
}

export const InterfaceManager: React.FC<InterfaceManagerProps> = ({ device }) => {
  const { devices, connections } = useNetworkStore();

  // 获取网段（前3个字节）
  const getNetwork = (ip: string) => {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  };

  // 识别网段类型（私网/公网）
  const getNetworkType = (ip: string): { type: string; color: string; icon: string } => {
    const firstOctet = parseInt(ip.split('.')[0]);

    // 私网地址 (RFC 1918) - 不能直接上互联网
    // 192.168.x.x - C类私网（常用于家庭、教室局域网）
    if (ip.startsWith('192.168.')) {
      return { type: '内网', color: 'bg-green-100 text-green-700', icon: '🏠' };
    }

    // 10.x.x.x - A类私网（常用于大型内网、小区、学校）
    if (firstOctet === 10) {
      return { type: '内网', color: 'bg-green-100 text-green-700', icon: '🏠' };
    }

    // 172.16.x.x ~ 172.31.x.x - B类私网
    if (firstOctet === 172) {
      const secondOctet = parseInt(ip.split('.')[1]);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return { type: '内网', color: 'bg-green-100 text-green-700', icon: '🏠' };
      }
    }

    // 其他 - 公网IP（互联网地址）
    return { type: '公网', color: 'bg-blue-100 text-blue-700', icon: '🌐' };
  };

  // 查找接口连接到哪些设备（支持多设备）
  const getConnectedDevices = (interfaceName: string): Device[] => {
    const connectedDevices: Device[] = [];

    // 找到包含当前设备的所有连接
    const deviceConnections = connections.filter(
      c => c.source === device.id || c.target === device.id
    );

    // 对于路由器，需要通过网段匹配来判断连接关系
    if (device.type === 'router') {
      const iface = device.interfaces?.find(i => i.name === interfaceName);
      if (!iface) return [];

      const ifaceNetwork = getNetwork(iface.ip);

      // ✅ 遍历所有连接，收集所有匹配的设备（而不是返回第一个）
      for (const conn of deviceConnections) {
        const otherDeviceId = conn.source === device.id ? conn.target : conn.source;
        const otherDevice = devices.find(d => d.id === otherDeviceId);

        if (!otherDevice) continue;

        // 检查对端设备是否有接口在同一网段
        if (otherDevice.type === 'router' && otherDevice.interfaces) {
          const hasMatchingInterface = otherDevice.interfaces.some(
            otherIface => getNetwork(otherIface.ip) === ifaceNetwork
          );
          if (hasMatchingInterface) {
            connectedDevices.push(otherDevice); // ✅ 添加到数组，继续查找
          }
        } else if (otherDevice.type === 'pc' || otherDevice.type === 'web' || otherDevice.type === 'dns') {
          // PC、Web服务器、DNS服务器只有一个接口
          if (getNetwork(otherDevice.ip) === ifaceNetwork) {
            connectedDevices.push(otherDevice); // ✅ 添加到数组，继续查找
          }
        }
      }
    }

    return connectedDevices;
  };

  // 检测接口配置问题
  const checkInterfaceIssues = (iface: NetworkInterface): string[] => {
    const issues: string[] = [];
    const connectedDevices = getConnectedDevices(iface.name);

    if (connectedDevices.length === 0) {
      issues.push('⚠️ 此接口没有连接到任何设备');
      return issues;
    }

    const ifaceNetwork = getNetwork(iface.ip);

    // 检查所有对端设备是否有相同网段的接口
    for (const connectedDevice of connectedDevices) {
      if (connectedDevice.type === 'router') {
        const hasMatchingInterface = connectedDevice.interfaces?.some(
          otherIface => getNetwork(otherIface.ip) === ifaceNetwork
        );

        if (!hasMatchingInterface) {
          issues.push(`❌ 网段不匹配！${connectedDevice.name} 没有 ${ifaceNetwork} 网段的接口`);

          // 建议修复
          const suggestedIP = connectedDevice.interfaces?.[0]?.ip;
          if (suggestedIP) {
            const suggestedNetwork = getNetwork(suggestedIP);
            issues.push(`💡 建议：将此接口改为 ${suggestedNetwork}.X 网段`);
          }
        }
      } else if (connectedDevice.type === 'pc' || connectedDevice.type === 'web' || connectedDevice.type === 'dns') {
        const deviceNetwork = getNetwork(connectedDevice.ip);
        if (deviceNetwork !== ifaceNetwork) {
          issues.push(`❌ 网段不匹配！${connectedDevice.name} 的IP是 ${connectedDevice.ip} (${deviceNetwork})`);
          issues.push(`💡 建议：将此接口改为 ${deviceNetwork} 网段`);
        }
      }
    }

    return issues;
  };

  if (device.type !== 'router') {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500">PC设备只有一个默认接口</p>
        <div className="mt-2 p-2 bg-white rounded">
          <span className="font-mono">eth0: {device.ip}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">🔧 {device.name} 接口配置（只读）</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          💡 Shift+连接时自动配置
        </span>
      </div>

      {/* 网段类型说明 */}
      <div className="mb-3 p-2 bg-blue-50 rounded text-xs">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-semibold text-blue-900">网段类型：</span>
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
            🏠 内网 (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
          </span>
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
            🌐 公网 (其他)
          </span>
        </div>
        <div className="text-blue-700 mt-1">
          💡 内网地址是私有网络专用，不能直接上互联网；公网地址是真正的互联网地址
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left">接口</th>
              <th className="px-3 py-2 text-left">IP地址</th>
              <th className="px-3 py-2 text-left">子网掩码</th>
              <th className="px-3 py-2 text-left">网段</th>
              <th className="px-3 py-2 text-left">连接到</th>
              <th className="px-3 py-2 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            {device.interfaces?.map((iface) => {
              const connectedDevices = getConnectedDevices(iface.name);
              const issues = checkInterfaceIssues(iface);

              return (
                <React.Fragment key={iface.id}>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono font-bold">
                      {iface.name}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono">{iface.ip}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-gray-600">
                        {iface.subnetMask || '255.255.255.0'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          {getNetwork(iface.ip)}
                        </span>
                        {(() => {
                          const netType = getNetworkType(iface.ip);
                          return (
                            <span className={`text-xs px-2 py-1 rounded font-medium ${netType.color}`}>
                              {netType.icon} {netType.type}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {connectedDevices.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {connectedDevices.map((dev, idx) => (
                            <div key={idx} className="text-green-700 font-bold">
                              {dev.type === 'pc' || dev.type === 'web' || dev.type === 'dns' ? '💻' : '🔀'} {dev.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">未连接</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {issues.length === 0 ? (
                        <span className="text-green-600">✅ 正常</span>
                      ) : (
                        <span className="text-red-600">❌ 有问题</span>
                      )}
                    </td>
                  </tr>
                  {issues.length > 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-2 bg-red-50">
                        <div className="text-xs space-y-1">
                          {issues.map((issue, idx) => (
                            <div key={idx} className="text-red-700">{issue}</div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 p-3 bg-green-50 rounded text-sm border border-green-200">
        <p className="text-green-800 font-bold mb-2">✨ 自动化配置说明：</p>
        <ul className="text-green-700 space-y-1 ml-4 text-xs">
          <li>• <strong>Shift+点击两个路由器</strong>：系统自动分配新的骨干网段（10.0.X.0）</li>
          <li>• <strong>自动创建接口</strong>：为两个路由器各添加一个新接口，IP自动配置</li>
          <li>• <strong>学生只需配置路由表</strong>：接口配置完全自动化，降低学习难度</li>
          <li>• 两个设备要通信，必须有接口在<strong>同一网段</strong>（系统已自动保证）</li>
        </ul>
      </div>
    </div>
  );
};
