import React, { useState, useEffect } from 'react';
import { Device } from '../types';
import { useNetworkStore } from '../store/useNetworkStore';
import { validateIPAddress, validateIPInput } from '../utils/ipValidator';
import { calculateSubnet, isValidSubnetMask } from '../utils/subnetUtils';

interface DeviceEditorProps {
  device: Device;
  onClose: () => void;
}

const DEFAULT_ENDPOINT_MASK = '255.255.255.0';

export const DeviceEditor: React.FC<DeviceEditorProps> = ({ device, onClose }) => {
  const { updateDevice, deleteDevice, devices, connections } = useNetworkStore();
  const [name, setName] = useState(device.name);
  const [ip, setIp] = useState(device.ip);
  const [dnsServer, setDnsServer] = useState(device.dnsServer || '');
  const [port, setPort] = useState(device.port || 80);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ipError, setIpError] = useState<string>('');
  const [ipWarning, setIpWarning] = useState<string>('');

  // 路由器专属字段
  const [lanSubnetMask, setLanSubnetMask] = useState('255.255.255.0');
  const [maskError, setMaskError] = useState<string>('');

  // 当device变化时，重置编辑状态
  useEffect(() => {
    setName(device.name);
    setIp(device.ip);
    setDnsServer(device.dnsServer || '');
    setPort(device.port || 80);
    setIpError('');
    setIpWarning('');

    // 路由器：加载LAN接口子网掩码
    if (device.type === 'router') {
      const lanInterface = device.interfaces?.find(i => i.name === 'LAN');
      setLanSubnetMask(lanInterface?.subnetMask || '255.255.255.0');
    }
    setMaskError('');
  }, [device.id]);

  // 获取所有DNS服务器列表
  const dnsServers = devices.filter((d) => d.type === 'dns');

  // 根据设备类型返回IP地址示例和说明
  const getIPHint = () => {
    if (device.type === 'pc' || device.type === 'web' || device.type === 'dns') {
      return {
        examples: '192.168.1.10, 192.168.2.20, 10.0.0.10',
        hint: '内网IP地址，必须与连接的路由器接口在同一网段'
      };
    }
    return null;
  };

  const ipHint = getIPHint();

  const handleIPChange = (value: string) => {
    setIp(value);

    // 实时输入验证
    const inputValidation = validateIPInput(value);
    setIpWarning(inputValidation.warning || '');

    // 清除之前的错误
    setIpError('');
  };

  const handleSave = () => {
    const ipChanged = ip !== device.ip;
    const relatedConnections = connections.filter(
      (conn) => conn.source === device.id || conn.target === device.id
    );
    const hasConnections = relatedConnections.length > 0;

    if (device.type !== 'router' && ipChanged && hasConnections) {
      const originalNetwork = calculateSubnet(device.ip, DEFAULT_ENDPOINT_MASK);
      const newNetwork = calculateSubnet(ip, DEFAULT_ENDPOINT_MASK);
      const networkChanged = originalNetwork !== newNetwork;
      if (networkChanged) {
        alert('⚠️ 当前设备仍在线，如需切换到不同网段，请先断开与路由器的连线后再修改IP。');
        return;
      }
    }

    // IP地址验证
    const ipValidation = validateIPAddress(ip);
    if (!ipValidation.valid) {
      setIpError(ipValidation.error || '');
      alert(`❌ IP地址错误\n\n${ipValidation.error}`);
      return;
    }

    // 路由器：验证子网掩码
    if (device.type === 'router') {
      const lanInterface = device.interfaces?.find((iface) => iface.name === 'LAN');
      const originalLanIP = lanInterface?.ip || device.ip;
      const originalNetwork = calculateSubnet(originalLanIP, lanInterface?.subnetMask || DEFAULT_ENDPOINT_MASK);
      const newNetwork = calculateSubnet(ip, lanSubnetMask);
      const routerNetworkChanged = originalNetwork !== newNetwork;

      if (routerNetworkChanged && hasConnections) {
        alert('⚠️ 修改此路由器的LAN网段前，请先断开所有与其相连的设备。');
        return;
      }

      if (!isValidSubnetMask(lanSubnetMask)) {
        setMaskError('无效的子网掩码格式');
        alert(`❌ 子网掩码错误\n\n请使用标准格式（如 255.255.255.0）`);
        return;
      }
    }

    const updates: Partial<Device> = {
      name,
      ip,
      interfaces: device.interfaces.map((iface) => {
        // 路由器：更新LAN接口的IP和子网掩码
        if (device.type === 'router' && iface.name === 'LAN') {
          const subnet = calculateSubnet(ip, lanSubnetMask);
          return {
            ...iface,
            ip,
            subnet,
            subnetMask: lanSubnetMask,
          };
        }
        // PC/DNS/Web：更新第一个接口的IP
        if (device.type !== 'router' && iface.name === 'eth0') {
          return { ...iface, ip };
        }
        return iface;
      })
    };

    // 只为PC设备保存DNS服务器配置
    if (device.type === 'pc') {
      // ✅ 验证DNS服务器是否仍然有效
      if (dnsServer) {
        const dnsDevice = devices.find(d => d.ip === dnsServer && d.type === 'dns');
        if (!dnsDevice) {
          const wrongTypeDevice = devices.find(d => d.ip === dnsServer);
          const errorMsg = wrongTypeDevice
            ? `⚠️ DNS配置失效\n\nIP ${dnsServer} 现在是 ${wrongTypeDevice.name} (${wrongTypeDevice.type === 'web' ? 'Web服务器' : wrongTypeDevice.type})，不再是DNS服务器！\n\n已自动清空DNS配置，请重新选择正确的DNS服务器。`
            : `⚠️ DNS配置失效\n\nIP ${dnsServer} 对应的设备不存在！\n\n已自动清空DNS配置，请重新选择。`;

          alert(errorMsg);
          updates.dnsServer = undefined; // 清空无效配置
        } else {
          updates.dnsServer = dnsServer;
        }
      } else {
        updates.dnsServer = undefined;
      }
    }

    // 为Web服务器保存端口配置
    if (device.type === 'web') {
      updates.port = port;
    }

    updateDevice(device.id, updates);
    onClose();
  };

  const handleDelete = () => {
    deleteDevice(device.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-lg font-bold mb-4">编辑设备 - {device.id}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">设备名称：</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              placeholder="R1, PC1, Server1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {device.type === 'router' ? 'LAN IP地址（局域网网关）：' : 'IP地址：'}
            </label>
            <input
              type="text"
              value={ip}
              onChange={(e) => handleIPChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded focus:ring-2 font-mono ${
                ipError
                  ? 'border-red-500 focus:ring-red-500'
                  : ipWarning
                  ? 'border-yellow-500 focus:ring-yellow-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="192.168.1.1"
            />
            {/* 实时警告提示 */}
            {ipWarning && !ipError && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <p className="text-yellow-700">
                  ⚠️ {ipWarning}
                </p>
              </div>
            )}
            {/* 错误提示 */}
            {ipError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                <p className="text-red-700">
                  ❌ {ipError}
                </p>
              </div>
            )}
            {/* IP提示信息 */}
            {ipHint && !ipError && !ipWarning && (
              <div className="mt-2 p-2 bg-blue-50 rounded text-xs space-y-1">
                <p className="text-blue-900">
                  <span className="font-semibold">💡 示例：</span>
                  <span className="font-mono ml-1">{ipHint.examples}</span>
                </p>
                <p className="text-blue-700">
                  <span className="font-semibold">⚠️ 注意：</span>
                  {ipHint.hint}
                </p>
              </div>
            )}
          </div>

          {/* 路由器专用：子网掩码配置 */}
          {device.type === 'router' && (
            <div>
              <label className="block text-sm font-medium mb-1">LAN子网掩码：</label>
              <input
                type="text"
                value={lanSubnetMask}
                onChange={(e) => {
                  setLanSubnetMask(e.target.value);
                  setMaskError('');
                }}
                className={`w-full px-3 py-2 border rounded focus:ring-2 font-mono ${
                  maskError
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="255.255.255.0"
              />
              {maskError && (
                <p className="mt-1 text-xs text-red-600">{maskError}</p>
              )}
              {!maskError && (
                <>
                  <p className="text-xs text-gray-500 mt-1">
                    默认 255.255.255.0（C类网络，254个主机）
                  </p>
                  {/* 自动显示LAN网段 */}
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                    <span className="font-semibold text-blue-900">LAN网段: </span>
                    <span className="font-mono text-blue-700">
                      {calculateSubnet(ip, lanSubnetMask) || '待计算'}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* PC设备专用：DNS服务器配置 */}
          {device.type === 'pc' && (
            <div>
              <label className="block text-sm font-medium mb-1">DNS服务器：</label>
              <select
                value={dnsServer}
                onChange={(e) => setDnsServer(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 未配置 --</option>
                {dnsServers.map((dns) => (
                  <option key={dns.id} value={dns.ip}>
                    {dns.name} ({dns.ip})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                浏览器模拟器将使用此DNS服务器解析域名
              </p>
            </div>
          )}

          {/* Web服务器专用：端口号配置 */}
          {device.type === 'web' && (
            <div>
              <label className="block text-sm font-medium mb-1">端口号：</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 80)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                placeholder="80"
                min="1"
                max="65535"
              />
              <p className="text-xs text-gray-500 mt-1">
                Web服务器监听的端口号（默认80）
              </p>
            </div>
          )}

          <div className="p-3 bg-yellow-50 rounded text-sm">
            <p className="text-yellow-800">
              ⚠️ <strong>注意：</strong>修改IP地址后，相关的路由表配置可能需要手动调整。
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center">
          {/* 左侧：删除按钮 */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition flex items-center space-x-1"
          >
            <span>🗑️</span>
            <span>删除设备</span>
          </button>

          {/* 右侧：取消和保存按钮 */}
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              保存
            </button>
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-red-600">⚠️ 确认删除</h3>

            <div className="space-y-3 mb-6">
              <p className="text-gray-700">
                确定要删除设备 <strong className="text-red-600">{device.name}</strong> 吗？
              </p>
              <div className="p-3 bg-red-50 rounded text-sm space-y-2">
                <p className="text-red-800">
                  <strong>⚠️ 此操作不可撤销！</strong>
                </p>
                <p className="text-red-700">
                  • 设备将被永久删除
                </p>
                <p className="text-red-700">
                  • 与该设备相关的所有连接也将被删除
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition font-semibold"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
