import React, { useState } from 'react';
import { Device, DNSRecord } from '../types';
import { useNetworkStore } from '../store/useNetworkStore';
import { DNSResolver } from '../utils/dnsResolver';

interface DNSManagerProps {
  device: Device;
}

export const DNSManager: React.FC<DNSManagerProps> = ({ device }) => {
  const { updateDevice, devices } = useNetworkStore();
  const [newDomain, setNewDomain] = useState('');
  const [newIP, setNewIP] = useState('');
  const [error, setError] = useState('');

  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDomain, setEditDomain] = useState('');
  const [editIP, setEditIP] = useState('');

  // 实时从store获取最新的设备数据
  const currentDevice = devices.find(d => d.id === device.id) || device;
  const dnsRecords = currentDevice.dnsRecords || [];

  const handleAddRecord = () => {
    setError('');

    // 验证域名格式
    if (!DNSResolver.validateDomain(newDomain)) {
      setError('❌ 域名格式不正确（示例：www.example.com）');
      return;
    }

    // 验证IP格式
    if (!DNSResolver.validateIP(newIP)) {
      setError('❌ IP地址格式不正确');
      return;
    }

    // 检查域名是否已存在
    if (dnsRecords.some((r) => r.domain.toLowerCase() === newDomain.toLowerCase())) {
      setError('❌ 该域名已存在');
      return;
    }

    const newRecord: DNSRecord = {
      id: `dns-${Date.now()}`,
      domain: newDomain,
      ip: newIP,
      type: 'A',
    };

    updateDevice(device.id, {
      dnsRecords: [...dnsRecords, newRecord],
    });

    // 清空输入
    setNewDomain('');
    setNewIP('');
    setError('');
  };

  const handleDeleteRecord = (recordId: string) => {
    updateDevice(device.id, {
      dnsRecords: dnsRecords.filter((r) => r.id !== recordId),
    });
  };

  const handleEditRecord = (record: DNSRecord) => {
    setEditingId(record.id);
    setEditDomain(record.domain);
    setEditIP(record.ip);
    setError('');
  };

  const handleSaveEdit = () => {
    setError('');

    // 验证域名格式
    if (!DNSResolver.validateDomain(editDomain)) {
      setError('❌ 域名格式不正确（示例：www.example.com）');
      return;
    }

    // 验证IP格式
    if (!DNSResolver.validateIP(editIP)) {
      setError('❌ IP地址格式不正确');
      return;
    }

    // 检查域名是否与其他记录冲突（排除当前编辑的记录）
    if (dnsRecords.some((r) => r.id !== editingId && r.domain.toLowerCase() === editDomain.toLowerCase())) {
      setError('❌ 该域名已存在');
      return;
    }

    // 更新记录
    updateDevice(device.id, {
      dnsRecords: dnsRecords.map((r) =>
        r.id === editingId
          ? { ...r, domain: editDomain, ip: editIP, type: 'A' }
          : r
      ),
    });

    // 退出编辑模式
    setEditingId(null);
    setEditDomain('');
    setEditIP('');
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDomain('');
    setEditIP('');
    setError('');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">
          🌐 DNS记录配置 - {device.name}
        </h3>
        <span className="text-sm text-gray-500">IP: {device.ip}</span>
      </div>

      {/* 当前DNS记录列表 */}
      <div className="mb-6">
        <h4 className="text-sm font-bold text-gray-700 mb-2">
          当前DNS记录 ({dnsRecords.length})
        </h4>
        {dnsRecords.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded border border-gray-200">
            <p className="text-gray-500">暂无DNS记录，请添加</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dnsRecords.map((record) => (
              <div
                key={record.id}
                className={`p-3 rounded border ${
                  editingId === record.id
                    ? 'bg-green-50 border-green-300'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                {editingId === record.id ? (
                  // 编辑模式
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          域名
                        </label>
                        <input
                          type="text"
                          value={editDomain}
                          onChange={(e) => setEditDomain(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          IP地址
                        </label>
                        <input
                          type="text"
                          value={editIP}
                          onChange={(e) => setEditIP(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                      >
                        ✓ 保存
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 bg-gray-400 text-white px-3 py-1 rounded text-sm hover:bg-gray-500 transition-colors"
                      >
                        ✕ 取消
                      </button>
                    </div>
                  </div>
                ) : (
                  // 查看模式
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-800">
                          {record.domain}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="font-mono text-blue-600">{record.ip}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditRecord(record)}
                        className="text-green-600 hover:text-green-800 text-sm font-bold px-2"
                        title="编辑记录"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(record.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-bold px-2"
                        title="删除记录"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加新记录 */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-bold text-gray-700 mb-3">➕ 添加DNS记录</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              域名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="例如：www.school.com"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              目标IP地址 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newIP}
              onChange={(e) => setNewIP(e.target.value)}
              placeholder="例如：192.168.1.100"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleAddRecord}
            disabled={!newDomain || !newIP}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-bold transition-colors"
          >
            ➕ 添加DNS记录
          </button>
        </div>
      </div>

      {/* 教学提示 */}
      <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
        <p className="text-sm text-yellow-800">
          <strong>💡 教学要点：</strong>
        </p>
        <ul className="text-xs text-yellow-700 mt-1 ml-4 space-y-1">
          <li>• DNS将域名（如www.school.com）转换为IP地址</li>
          <li>• A记录：直接映射域名到IP地址</li>
          <li>• 对应课本第7课《域名解析换编码》</li>
        </ul>
      </div>
    </div>
  );
};