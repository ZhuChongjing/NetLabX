import React, { useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';

interface ConnectionManagerProps {
  onClose: () => void;
}

export const ConnectionManager: React.FC<ConnectionManagerProps> = ({ onClose }) => {
  const { devices, connections, addConnection, deleteConnection } = useNetworkStore();
  const [sourceDevice, setSourceDevice] = useState('');
  const [targetDevice, setTargetDevice] = useState('');

  const handleAddConnection = () => {
    if (!sourceDevice || !targetDevice) {
      alert('请选择源设备和目标设备');
      return;
    }

    if (sourceDevice === targetDevice) {
      alert('源设备和目标设备不能相同');
      return;
    }

    // 检查是否已存在连接
    const existingConnection = connections.find(
      (c) =>
        (c.source === sourceDevice && c.target === targetDevice) ||
        (c.source === targetDevice && c.target === sourceDevice)
    );

    if (existingConnection) {
      alert('这两个设备已经连接');
      return;
    }

    const newConnection = {
      id: `conn-${Date.now()}`,
      source: sourceDevice,
      target: targetDevice
    };

    addConnection(newConnection);
    setSourceDevice('');
    setTargetDevice('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">🔗 连接管理</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* 添加新连接 */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-bold text-blue-800 mb-3">➕ 添加新连接</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                源设备
              </label>
              <select
                value={sourceDevice}
                onChange={(e) => setSourceDevice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 选择设备 --</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.type === 'pc' ? '💻' : '🔀'} {device.name} ({device.ip})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                目标设备
              </label>
              <select
                value={targetDevice}
                onChange={(e) => setTargetDevice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 选择设备 --</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.type === 'pc' ? '💻' : '🔀'} {device.name} ({device.ip})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleAddConnection}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-bold"
          >
            ✓ 添加连接
          </button>
        </div>

        {/* 已有连接列表 */}
        <div>
          <h4 className="font-bold text-gray-800 mb-3">📋 已有连接 ({connections.length})</h4>
          {connections.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>暂无连接</p>
              <p className="text-sm mt-1">添加设备后开始连接</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => {
                const source = devices.find((d) => d.id === conn.source);
                const target = devices.find((d) => d.id === conn.target);

                if (!source || !target) return null;

                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">
                        {source.type === 'pc' ? '💻' : '🔀'} <strong>{source.name}</strong>
                      </span>
                      <span className="text-gray-400">⟷</span>
                      <span className="font-mono text-sm">
                        {target.type === 'pc' ? '💻' : '🔀'} <strong>{target.name}</strong>
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`确定删除连接 ${source.name} ⟷ ${target.name}？`)) {
                          deleteConnection(conn.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-800 font-bold px-3 py-1 rounded hover:bg-red-50"
                    >
                      🗑️ 删除
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 关闭按钮 */}
        <div className="mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors font-bold"
          >
            ✕ 关闭
          </button>
        </div>
      </div>
    </div>
  );
};
