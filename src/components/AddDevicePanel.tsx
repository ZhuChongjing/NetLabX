import React, { useState } from 'react';
import { Device, DeviceType } from '../types';
import { useNetworkStore } from '../store/useNetworkStore';
import { validateIPAddress, validateIPInput } from '../utils/ipValidator';
import { calculateSubnet, isValidSubnetMask } from '../utils/subnetUtils';

interface AddDevicePanelProps {
  onClose: () => void;
}

export const AddDevicePanel: React.FC<AddDevicePanelProps> = ({ onClose }) => {
  const { addDevice, devices } = useNetworkStore();
  const [deviceType, setDeviceType] = useState<DeviceType>('pc');
  const [deviceName, setDeviceName] = useState('');
  const [deviceIP, setDeviceIP] = useState('192.168.1.1');
  const [ipError, setIpError] = useState<string>('');
  const [ipWarning, setIpWarning] = useState<string>('');
  const [webPort, setWebPort] = useState('80');
  const [portError, setPortError] = useState<string>('');

  // 路由器专属字段
  const [lanIP, setLanIP] = useState('192.168.1.1');
  const [subnetMask, setSubnetMask] = useState('255.255.255.0');
  const [maskError, setMaskError] = useState<string>('');

  const handleIPChange = (value: string) => {
    setDeviceIP(value);

    // 实时输入验证
    const inputValidation = validateIPInput(value);
    setIpWarning(inputValidation.warning || '');

    // 清除之前的错误
    setIpError('');
  };

  const handleAddDevice = () => {
    // 生成唯一ID
    const id = `${deviceType}-${Date.now()}`;

    // 根据设备类型生成默认名称
    const defaultNames: Record<DeviceType, string> = {
      pc: `PC${devices.filter(d => d.type === 'pc').length + 1}`,
      router: `R${devices.filter(d => d.type === 'router').length + 1}`,
      server: `Server${devices.filter(d => d.type === 'server').length + 1}`,
      dns: `DNS${devices.filter(d => d.type === 'dns').length + 1}`,
      web: `Web${devices.filter(d => d.type === 'web').length + 1}`,
    };

    // 路由器：创建时生成LAN接口
    if (deviceType === 'router') {
      // 验证LAN IP
      const ipValidation = validateIPAddress(lanIP);
      if (!ipValidation.valid) {
        setIpError(ipValidation.error || '');
        alert(`❌ LAN IP地址错误\n\n${ipValidation.error}`);
        return;
      }

      // 验证子网掩码
      if (!isValidSubnetMask(subnetMask)) {
        setMaskError('无效的子网掩码格式');
        alert(`❌ 子网掩码错误\n\n请使用标准格式（如 255.255.255.0）`);
        return;
      }

      // 计算子网地址
      const subnet = calculateSubnet(lanIP, subnetMask);

      const newRouter: Device = {
        id,
        name: deviceName || defaultNames[deviceType],
        type: 'router',
        ip: lanIP, // 主IP = LAN IP
        interfaces: [
          {
            id: `${id}-lan`,
            name: 'LAN',
            ip: lanIP,
            subnet: subnet,
            subnetMask: subnetMask,
          }
        ],
        position: { x: 400, y: 300 },
        routingTable: [],
      };

      addDevice(newRouter);
      onClose();
      return;
    }

    // 其他设备（PC/DNS/Web）
    const ipValidation = validateIPAddress(deviceIP);
    if (!ipValidation.valid) {
      setIpError(ipValidation.error || '');
      alert(`❌ IP地址错误\n\n${ipValidation.error}`);
      return;
    }

    let resolvedPort: number | undefined;
    if (deviceType === 'web') {
      const trimmed = webPort.trim();
      const parsed = Number(trimmed);
      if (!trimmed) {
        setPortError('请填写监听端口');
        alert('❌ Web服务器端口不能为空\n\n请填写1-65535之间的整数，例如80或8080。');
        return;
      }
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        setPortError('端口需为1-65535的整数');
        alert('❌ Web服务器端口无效\n\n请填写1-65535之间的整数，例如80或8080。');
        return;
      }
      setPortError('');
      resolvedPort = parsed;
    } else {
      setPortError('');
    }

    const newDevice: Device = {
      id,
      name: deviceName || defaultNames[deviceType],
      type: deviceType,
      ip: deviceIP,
      interfaces: [
        { id: `${id}-eth0`, name: 'eth0', ip: deviceIP }
      ],
      position: { x: 400, y: 300 },
      dnsRecords: deviceType === 'dns' ? [] : undefined,
      webContent: deviceType === 'web' ? '' : undefined,
      domain: deviceType === 'web' ? '' : undefined,
      port: deviceType === 'web' ? resolvedPort : undefined,
    };

    addDevice(newDevice);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">➕ 添加网络设备</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1">
          {/* 设备类型 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              设备类型
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeviceType('pc')}
                className={`py-3 px-3 rounded-lg border-2 transition-all ${
                  deviceType === 'pc'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-1">💻</div>
                <div className="font-bold text-sm">电脑 PC</div>
              </button>
              <button
                onClick={() => setDeviceType('router')}
                className={`py-3 px-3 rounded-lg border-2 transition-all ${
                  deviceType === 'router'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-1">🔀</div>
                <div className="font-bold text-sm">路由器</div>
              </button>
              <button
                onClick={() => setDeviceType('dns')}
                className={`py-3 px-3 rounded-lg border-2 transition-all ${
                  deviceType === 'dns'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-1">🔍</div>
                <div className="font-bold text-sm">DNS服务器</div>
              </button>
              <button
                onClick={() => setDeviceType('web')}
                className={`py-3 px-3 rounded-lg border-2 transition-all ${
                  deviceType === 'web'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-1">🌐</div>
                <div className="font-bold text-sm">Web服务器</div>
              </button>
            </div>
          </div>

          {/* 设备名称 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              设备名称
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder={`例如: ${deviceType === 'pc' ? 'PC1' : deviceType === 'router' ? 'R1' : deviceType === 'dns' ? 'DNS1' : 'Web1'}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 路由器专属配置 */}
          {deviceType === 'router' ? (
            <>
              {/* LAN IP地址 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  LAN IP地址（局域网网关）
                </label>
                <input
                  type="text"
                  value={lanIP}
                  onChange={(e) => setLanIP(e.target.value)}
                  placeholder="192.168.1.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="mt-1 text-xs text-gray-500">
                  局域网网关地址，连接到此路由器的PC将使用此IP作为网关
                </p>
              </div>

              {/* 子网掩码 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  子网掩码
                </label>
                <input
                  type="text"
                  value={subnetMask}
                  onChange={(e) => {
                    setSubnetMask(e.target.value);
                    setMaskError('');
                  }}
                  placeholder="255.255.255.0"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono ${
                    maskError
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                />
                {maskError && (
                  <p className="mt-1 text-xs text-red-600">{maskError}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  默认 255.255.255.0（C类网络，254个主机）
                </p>
              </div>

              {/* 自动显示LAN网段 */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-900">LAN网段:</span>
                  <span className="text-sm font-mono text-blue-700">
                    {calculateSubnet(lanIP, subnetMask) || '待计算'}
                  </span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  此网段内的PC可以直接连接到路由器LAN口
                </p>
              </div>
            </>
          ) : (
            /* 非路由器设备的IP地址 */
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                IP 地址
              </label>
              <input
                type="text"
                value={deviceIP}
                onChange={(e) => handleIPChange(e.target.value)}
                placeholder="192.168.1.1"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono ${
                  ipError
                    ? 'border-red-500 focus:ring-red-500'
                    : ipWarning
                    ? 'border-yellow-500 focus:ring-yellow-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
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
              {/* 格式说明 */}
              {!ipError && !ipWarning && (
                <p className="mt-1 text-xs text-gray-500">
                  格式: 由4个0-255的十进制数字组成，真实IP不能以0开头（如 192.168.1.1）
                </p>
              )}
            </div>
          )}

          {deviceType === 'web' && (
            <div className="mt-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                监听端口
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                value={webPort}
                onChange={(e) => setWebPort(e.target.value)}
                placeholder="80"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono ${
                  portError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
                }`}
              />
              {portError ? (
                <p className="mt-2 text-sm text-red-600">❌ {portError}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  默认为 80（HTTP）。若需自定义端口，如 8080 或 443，请确保与浏览器模拟器中的端口一致。
                </p>
              )}
            </div>
          )}

          {/* 提示信息 */}
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-700">
              💡 <strong>提示：</strong>添加设备后，需要手动连接到其他设备
              {deviceType === 'router' && '，并配置路由表'}
              {deviceType === 'dns' && '，并添加DNS记录'}
              {deviceType === 'web' && '，并配置网页内容与端口'}。
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleAddDevice}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-bold"
            >
              ✓ 添加设备
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors font-bold"
            >
              ✕ 取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
