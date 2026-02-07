import React from 'react';
import { Device } from '../types';

interface RoutingTableProps {
  device: Device;
}

export const RoutingTable: React.FC<RoutingTableProps> = ({ device }) => {
  if (!device.routingTable || device.type !== 'router') {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500">此设备没有路由表</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-bold mb-3">{device.name} 的路由表</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left">目标网络</th>
              <th className="px-3 py-2 text-left">下一站</th>
              <th className="px-3 py-2 text-left">优先级</th>
              <th className="px-3 py-2 text-left">接口</th>
            </tr>
          </thead>
          <tbody>
            {device.routingTable.map((entry, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{entry.destination}</td>
                <td className="px-3 py-2 font-mono">{entry.nextHop}</td>
                <td className="px-3 py-2 text-center">{entry.metric}</td>
                <td className="px-3 py-2 font-mono">{entry.interface}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
        <p className="text-blue-800">
          💡 <strong>提示：</strong>路由器收到数据包后，会根据目的地IP地址在这个表中查找，
          然后把数据包转发给"下一站"。
        </p>
      </div>

      <div className="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded text-sm">
        <p className="text-yellow-800 font-semibold mb-1">📚 教学说明:</p>
        <ul className="text-yellow-700 space-y-1 ml-4">
          <li>• "下一站"栏显示的是<strong>目标路由器名称</strong>,便于理解网络拓扑</li>
          <li>• 真实网络设备中,下一站应填写<strong>下一个路由器的骨干网接口IP地址</strong></li>
          <li>• 例如: "R2-阿强家路由" → 实际应填写 "58.20.0.2" (R2的eth0接口IP)</li>
        </ul>
      </div>
    </div>
  );
};
