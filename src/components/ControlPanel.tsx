import React, { useState, useEffect, useMemo } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';

export const ControlPanel: React.FC = () => {
  const {
    simulatePing,
    clearSimulation,
    simulationResult,
    isSimulating,
    testToolState,
    setTestToolState,
    simulationType,
    devices
  } = useNetworkStore();

  // 本地状态：Ping测试结果（当浏览器测试开始时会被清空）
  const [localSimulationResult, setLocalSimulationResult] = useState(simulationResult);

  const sourceIP = testToolState.sourceIP;
  const destIP = testToolState.destIP;

  const deviceOptions = useMemo(() => {
    return devices.map((device) => ({
      value: device.ip,
      label: `${device.name} (${device.ip})`
    }));
  }, [devices]);

  const setSourceIP = (ip: string) => setTestToolState({ ...testToolState, sourceIP: ip });
  const setDestIP = (ip: string) => setTestToolState({ ...testToolState, destIP: ip });

  // 监听simulationType，当浏览器测试开始时清空Ping结果（实现工具互不干扰）
  useEffect(() => {
    if (simulationType === 'dns' || simulationType === 'http') {
      // 浏览器测试开始了，清空Ping的本地结果
      setLocalSimulationResult(null);
    } else if (simulationType === 'ping') {
      // Ping测试开始，更新本地结果
      setLocalSimulationResult(simulationResult);
    }
  }, [simulationType, simulationResult]);

  const handlePing = () => {
    // 开始Ping测试（simulatePing会设置simulationType='ping'，触发浏览器组件清空状态）
    simulatePing(sourceIP, destIP);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow space-y-4">
      <h3 className="text-lg font-bold mb-4">连通测试工具</h3>

      {/* IP输入 */}
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">源设备：</label>
          <select
            value={sourceIP}
            onChange={(e) => setSourceIP(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">请选择源设备</option>
            {deviceOptions.map((option) => (
              <option key={`src-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
            {!deviceOptions.some((option) => option.value === sourceIP) && sourceIP && (
              <option value={sourceIP}>{sourceIP}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">目标设备：</label>
          <select
            value={destIP}
            onChange={(e) => setDestIP(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">请选择目标设备</option>
            {deviceOptions.map((option) => (
              <option key={`dest-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
            {!deviceOptions.some((option) => option.value === destIP) && destIP && (
              <option value={destIP}>{destIP}</option>
            )}
          </select>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="space-y-2">
        <button
          onClick={handlePing}
          disabled={isSimulating}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 transition"
        >
          {isSimulating ? '正在模拟...' : '📍 连通测试'}
        </button>
        <button
          onClick={() => {
            clearSimulation();
            setLocalSimulationResult(null);
          }}
          className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
        >
          清除结果
        </button>
      </div>

      {/* 结果显示 */}
      {localSimulationResult && (
        <div className={`p-4 rounded-lg ${localSimulationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <h4 className="font-bold mb-2">
            {localSimulationResult.success ? '✅ 连接成功' : '❌ 连接失败'}
          </h4>
          <p className="text-sm mb-2">{localSimulationResult.message}</p>
          <div className="text-sm">
            <strong>路径：</strong>
            <div className="mt-1 p-2 bg-white rounded font-mono text-xs">
              {localSimulationResult.path.join(' → ')}
            </div>
          </div>
          {localSimulationResult.steps.length > 0 && (
            <div className="mt-3">
              <strong className="text-sm">详细步骤：</strong>
              <div className="mt-2 space-y-2">
                {localSimulationResult.steps.map((step, index) => (
                  <div key={index} className="p-2 bg-white rounded text-xs">
                    <div className="font-bold">{index + 1}. {step.router}</div>
                    <div className="text-gray-600">{step.action}</div>
                    {step.routeEntry && (
                      <div className="mt-1 text-gray-500">
                        路由条目：{step.routeEntry.destination} → {step.routeEntry.nextHop} (权重: {step.routeEntry.metric})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
