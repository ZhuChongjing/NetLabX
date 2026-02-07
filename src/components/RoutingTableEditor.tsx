import React, { useState, useEffect } from 'react';
import { Device, RouteEntry } from '../types';
import { useNetworkStore } from '../store/useNetworkStore';

interface RoutingTableEditorProps {
  device: Device;
}

export const RoutingTableEditor: React.FC<RoutingTableEditorProps> = ({ device }) => {
  const { updateDevice, devices } = useNetworkStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTable, setEditedTable] = useState<RouteEntry[]>(device.routingTable || []);
  const [originalTable, setOriginalTable] = useState<RouteEntry[]>(device.routingTable || []); // 保存编辑前的快照

  // ✅ 修复：切换设备时重置编辑状态
  // 注意：现在非编辑模式直接渲染 device.routingTable，不需要同步到 editedTable
  useEffect(() => {
    // 切换设备时，强制退出编辑模式
    setIsEditing(false);
  }, [device.id]); // 只监听 device.id 的变化

  // ✅ 修复：根据编辑状态选择数据源
  // 编辑模式：使用本地状态 editedTable
  // 显示模式：直接使用 Zustand store 的最新数据
  const displayTable = isEditing ? editedTable : (device.routingTable || []);

  // 获取所有路由器名称（用于下一站下拉框）
  const allRouters = devices.filter(d => d.type === 'router' && d.id !== device.id);

  // 获取当前路由器的所有接口（用于接口下拉框）
  const currentInterfaces = device.interfaces || [];

  if (!device.routingTable || device.type !== 'router') {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500">此设备没有路由表</p>
      </div>
    );
  }

  const handleSave = () => {
    // 检查同一目标网络的权重是否重复
    const destinationMetricMap = new Map<string, Set<number>>();

    for (const entry of editedTable) {
      if (!destinationMetricMap.has(entry.destination)) {
        destinationMetricMap.set(entry.destination, new Set());
      }

      const metrics = destinationMetricMap.get(entry.destination)!;
      if (metrics.has(entry.metric)) {
        // 发现重复权重
        alert(`❌ 保存失败：目标网络 ${entry.destination} 存在重复的权重 ${entry.metric}！\n\n同一目标网络的不同路由必须使用不同的权重值。`);
        return; // 阻止保存
      }
      metrics.add(entry.metric);
    }

    // 验证通过，保存路由表
    updateDevice(device.id, { routingTable: editedTable });

    // ✅ 修复：立即更新本地状态，避免等待 useEffect
    // 创建新的深拷贝，确保 originalTable 也是最新的（用于下次编辑）
    const savedCopy = editedTable.map(entry => ({ ...entry }));
    setOriginalTable(savedCopy);

    // 退出编辑模式（此时 editedTable 和 originalTable 都是最新的）
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTable(originalTable); // 恢复到编辑前的快照
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    // ✅ 修复：从 Zustand store 读取最新的路由表，而不是依赖 props
    // 这样可以确保拿到保存后的最新数据
    const currentDevice = devices.find(d => d.id === device.id);
    const latestRoutingTable = currentDevice?.routingTable || device.routingTable || [];

    // 🔧 创建两个独立的深拷贝，避免引用共享
    const editCopy = latestRoutingTable.map(entry => ({ ...entry }));
    const snapshotCopy = latestRoutingTable.map(entry => ({ ...entry }));

    setEditedTable(editCopy);       // 用于编辑的副本
    setOriginalTable(snapshotCopy); // 用于取消的独立快照
    setIsEditing(true);
  };

  const handleAddRow = () => {
    setEditedTable([
      ...editedTable,
      { destination: '192.168.0.0', nextHop: '直连', metric: 0, interface: 'LAN' }
    ]);
  };

  const handleDeleteRow = (index: number) => {
    setEditedTable(editedTable.filter((_, i) => i !== index));
  };

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= editedTable.length) return;
    const newTable = [...editedTable];
    const [row] = newTable.splice(index, 1);
    newTable.splice(newIndex, 0, row);
    setEditedTable(newTable);
  };

  // 根据下一站和目标网络，获取推荐的接口
  const getRecommendedInterface = (entry: RouteEntry): string | null => {
    const getNetwork = (ip: string) => {
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    };

    if (entry.nextHop === '-' || entry.nextHop === '直连' || entry.nextHop === '0.0.0.0') {
      // 直连：接口应该和目标网络在同一网段
      const iface = currentInterfaces.find(
        iface => getNetwork(iface.ip) === entry.destination
      );
      return iface?.name || null;
    } else {
      // 转发：接口应该和下一站路由器在同一网段
      const nextRouter = allRouters.find(r => r.name === entry.nextHop);
      if (!nextRouter) return null;

      // 查找和下一站路由器有共同网段的接口
      for (const myIface of currentInterfaces) {
        const myNet = getNetwork(myIface.ip);
        for (const nextIface of (nextRouter.interfaces || [])) {
          const nextNet = getNetwork(nextIface.ip);
          if (myNet === nextNet) {
            return myIface.name;
          }
        }
      }
      return null;
    }
  };

  const handleCellChange = (index: number, field: keyof RouteEntry, value: string | number) => {
    const newTable = [...editedTable];
    newTable[index] = { ...newTable[index], [field]: value };

    // 当修改destination或nextHop时,自动更新interface为推荐值
    if (field === 'destination' || field === 'nextHop') {
      const recommendedInterface = getRecommendedInterface(newTable[index]);
      if (recommendedInterface) {
        newTable[index].interface = recommendedInterface;
      }
    }

    setEditedTable(newTable);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">{device.name} 的路由表</h3>
        <div className="space-x-2">
          {!isEditing ? (
            <button
              onClick={handleStartEditing}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition"
            >
              ✏️ 编辑
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition"
              >
                ✓ 保存
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400 transition"
              >
                ✕ 取消
              </button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left">目标网络</th>
              <th className="px-3 py-2 text-left">下一站</th>
              <th className="px-3 py-2 text-left">优先级</th>
              <th className="px-3 py-2 text-left">接口</th>
              {isEditing && <th className="px-3 py-2 text-center">操作</th>}
            </tr>
          </thead>
          <tbody>
            {displayTable.map((entry, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="text"
                      value={entry.destination}
                      onChange={(e) => handleCellChange(index, 'destination', e.target.value)}
                      className="w-full px-2 py-1 border rounded font-mono text-xs"
                      placeholder="192.168.20.0"
                    />
                  ) : (
                    <span className="font-mono">{entry.destination}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <select
                      value={entry.nextHop}
                      onChange={(e) => handleCellChange(index, 'nextHop', e.target.value)}
                      className="w-full px-2 py-1 border rounded font-mono text-xs bg-white"
                    >
                      <option value="直连">直连 (本地网络)</option>
                      {allRouters.map(router => (
                        <option key={router.id} value={router.name}>
                          {router.name} ({router.ip})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono">
                      {entry.nextHop === '-' || entry.nextHop === '直连' ? '直连' : entry.nextHop}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <input
                      type="number"
                      value={entry.metric}
                      onChange={(e) => handleCellChange(index, 'metric', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 border rounded text-center"
                      min="0"
                    />
                  ) : (
                    <span className="text-center block">{entry.metric}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isEditing ? (
                    <div className="relative">
                      <select
                        value={entry.interface}
                        onChange={(e) => handleCellChange(index, 'interface', e.target.value)}
                        className="w-full px-2 py-1 border rounded font-mono text-xs bg-white"
                      >
                        {currentInterfaces.map(iface => {
                          const recommended = getRecommendedInterface(entry);
                          const isRecommended = iface.name === recommended;
                          return (
                            <option key={iface.id} value={iface.name}>
                              {isRecommended ? '✅ ' : ''}{iface.name} ({iface.ip})
                            </option>
                          );
                        })}
                      </select>
                      {(() => {
                        const recommended = getRecommendedInterface(entry);
                        if (recommended && entry.interface !== recommended) {
                          return (
                            <div className="absolute -bottom-5 left-0 text-xs text-orange-600 whitespace-nowrap">
                              💡 建议: {recommended}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  ) : (
                    <span className="font-mono">{entry.interface}</span>
                  )}
                </td>
                {isEditing && (
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleMoveRow(index, 'up')}
                        className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition disabled:opacity-50"
                        disabled={index === 0}
                        title="上移一行"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveRow(index, 'down')}
                        className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 transition disabled:opacity-50"
                        disabled={index === displayTable.length - 1}
                        title="下移一行"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleDeleteRow(index)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditing && (
        <button
          onClick={handleAddRow}
          className="mt-3 px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition"
        >
          + 添加路由条目
        </button>
      )}

      <div className="mt-3 space-y-2">
        <div className="p-3 bg-blue-50 rounded text-sm">
          <p className="text-blue-800 font-bold mb-2">💡 路由表填写说明：</p>
          <ul className="text-blue-700 space-y-1 ml-4">
            <li><strong>目标网络：</strong>要到达的网络地址（如 192.168.20.0）</li>
            <li><strong>下一站：</strong>
              <ul className="ml-4 mt-1">
                <li>• 选择 <code className="bg-white px-1 rounded">直连</code> = 这个网络直接连在本路由器上</li>
                <li>• 选择其他路由器名称 = 需要把数据包转发给该路由器（如 R2-阿强家路由）</li>
              </ul>
            </li>
            <li><strong>优先级：</strong>数值越小越先走，直连必须为0
              <br/><span className="text-xs">⚠️ 如果有多条路由到同一目标，系统会自动选择权重最小的！</span>
              <br/><span className="text-xs text-red-600">❌ 同一目标网络的不同路由不能使用相同的权重！</span>
            </li>
            <li><strong>接口：</strong>从哪个网口发出数据包
              <br/><span className="text-xs text-green-600">✨ 修改目标网络或下一站时，接口会自动更新为推荐值！</span>
            </li>
          </ul>
        </div>

        <div className="p-3 bg-yellow-50 rounded text-sm border border-yellow-200">
          <p className="text-yellow-800">
            <strong>⚠️ 重要规则：</strong>
          </p>
          <ul className="text-yellow-700 space-y-1 ml-4 mt-1">
            <li>• 如果下一站是 <code className="bg-white px-1 rounded">直连</code>，权重必须是 <code className="bg-white px-1 rounded">0</code></li>
            <li>• 如果下一站是其他路由器，权重通常 ≥ 1</li>
            <li>• 接口会根据目标网络和下一站自动选择（系统智能推荐）</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
