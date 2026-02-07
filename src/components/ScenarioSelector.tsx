import React, { useState, useEffect } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';

/**
 * 场景选择器组件 - 横向布局版本
 *
 * 功能：
 * - 从服务器加载教学案例文件夹中的JSON案例（通过安全API，防止目录遍历）
 *   - API: GET /api/teaching-scenarios - 获取案例列表（返回安全的数字ID）
 *   - API: GET /api/teaching-scenario/:id - 加载指定案例（ID为数组索引，防止目录遍历）
 * - 清空当前拓扑
 * - 保存/加载拓扑配置
 */

interface TeachingScenario {
  id: number;
  name: string;
  description: string;
}

export const ScenarioSelector: React.FC = () => {
  const { clearTopology, exportTopology, importTopology } = useNetworkStore();
  const [teachingScenarios, setTeachingScenarios] = useState<TeachingScenario[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  // 组件加载时获取教学案例列表
  useEffect(() => {
    fetchTeachingScenarios();
  }, []);

  // 获取教学案例列表
  const fetchTeachingScenarios = async () => {
    try {
      setLoadingScenarios(true);
      const response = await fetch('http://localhost:3001/api/teaching-scenarios');
      if (!response.ok) {
        throw new Error('获取教学案例列表失败');
      }
      const data = await response.json();
      setTeachingScenarios(data.scenarios || []);
      console.log('✅ 教学案例列表已刷新:', data.scenarios.length);
    } catch (error) {
      console.error('❌ 获取教学案例列表失败:', error);
      // 失败时静默处理，不影响其他功能
    } finally {
      setLoadingScenarios(false);
    }
  };

  // 加载教学案例（通过安全ID）
  const handleLoadTeachingScenario = async (scenarioId: number) => {
    try {
      const response = await fetch(`http://localhost:3001/api/teaching-scenario/${scenarioId}`);
      if (!response.ok) {
        throw new Error('加载教学案例失败');
      }
      const data = await response.json();
      const scenario = data.scenario;
      const picked = teachingScenarios.find((s) => s.id === scenarioId);
      const displayName = scenario.name || scenario.fileName || picked?.name || `案例${scenarioId}`;

      // 使用importTopology加载案例数据
      const jsonData = JSON.stringify({
        devices: scenario.devices || [],
        connections: scenario.connections || []
      });
      importTopology(jsonData);
      alert(`✅ 已加载教学案例：${displayName}`);
    } catch (error) {
      console.error('❌ 加载教学案例失败:', error);
      alert('加载教学案例失败，请确保服务器正在运行');
    }
  };

  const handleClear = () => {
    if (!confirm('确定要清空所有设备和连接吗？此操作不可撤销！')) {
      return;
    }
    clearTopology();
  };

  const handleSave = () => {
    try {
      const jsonData = exportTopology();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `网络拓扑_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('💾 拓扑已保存到文件');
    } catch (error) {
      alert(`保存失败: ${error}`);
    }
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const jsonData = event.target?.result as string;
          importTopology(jsonData);
          alert('✅ 拓扑加载成功！');
        } catch (error) {
          alert(`加载失败: ${error}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };


  return (
    <div className="bg-white p-3 rounded-lg shadow-md">
      <div className="flex items-center justify-between gap-3">
        {/* 左侧：拓扑场景按钮 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">📚 教学案例:</span>

          {/* 教学案例下拉选择器 */}
          <select
            onClick={fetchTeachingScenarios}
            onChange={(e) => {
              const scenarioId = parseInt(e.target.value, 10);
              if (!isNaN(scenarioId) && scenarioId >= 0) {
                if (confirm('加载教学案例将清空当前配置，是否继续？')) {
                  handleLoadTeachingScenario(scenarioId);
                  e.currentTarget.value = '';
                }
              }
            }}
            disabled={loadingScenarios && teachingScenarios.length === 0}
            className="px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-xs font-medium whitespace-nowrap disabled:opacity-50"
            title="从教学案例文件夹加载拓扑"
            defaultValue=""
          >
            <option value="" disabled>
              {loadingScenarios ? '⏳ 刷新中...' : '📂 案例教学（点击展开文件列表）'}
            </option>
            {teachingScenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
            {teachingScenarios.length === 0 && (
              <option value="" disabled>
                {loadingScenarios ? '⏳ 刷新中...' : '（暂无案例）'}
              </option>
            )}
          </select>

          <button
            onClick={handleClear}
            className="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 text-xs font-medium whitespace-nowrap"
            title="清空所有设备和连接"
          >
            🗑️ 清空
          </button>
        </div>

        {/* 右侧：文件操作按钮 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">💾 文件:</span>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 text-xs font-medium whitespace-nowrap"
            title="保存当前拓扑配置"
          >
            💾 保存
          </button>

          <button
            onClick={handleLoad}
            className="px-3 py-1.5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 text-xs font-medium whitespace-nowrap"
            title="从文件加载拓扑配置"
          >
            📂 加载
          </button>

        </div>
      </div>
    </div>
  );
};
