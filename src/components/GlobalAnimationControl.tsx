import React from 'react';
import { useNetworkStore } from '../store/useNetworkStore';

/**
 * 全局动画速度控制组件
 *
 * 功能：
 * - 控制所有模拟动画的速度（连通测试/DNS/HTTP）
 * - 提供单步模式的"下一步"按钮
 * - 显示清晰的说明文字，强调这是全局设置
 */
export const GlobalAnimationControl: React.FC = () => {
  const { gradingTools, setAnimationMode, isSimulating, stepForward } = useNetworkStore();
  const animationMode = gradingTools.animationMode || 'normal';

  return (
    <div className="h-full bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md p-4 border border-purple-200 flex flex-col">
      {/* 第一行：标题和说明 */}
      <div>
        <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
          🌍 全局动画速度
        </h3>
        <p className="text-xs text-purple-700 mt-0.5">
          连通测试 / DNS / HTTP动画路径演示
        </p>
      </div>

      {/* 第二行：速度选择器 + 单步按钮（占位） */}
      <div className="mt-2 flex items-center gap-3">
        {/* 速度选择器 */}
        <div className="w-64">
          <select
            value={animationMode}
            onChange={(e) => setAnimationMode(e.target.value as any)}
            className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-sm font-medium shadow-sm"
          >
            <option value="step">🐢 单步模式（教学演示）</option>
            <option value="normal">⏯️ 正常速度</option>
            <option value="fast">⚡ 快速（批改作业）</option>
          </select>
        </div>

        {/* 单步按钮（仅单步模式显示，其他模式保留占位） */}
        <div className="w-24">
          {animationMode === 'step' && (
            <button
              onClick={stepForward}
              disabled={!isSimulating}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700
                         disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm
                         shadow-md transform hover:scale-105 transition-all whitespace-nowrap"
              title="单步模式下，点击前进一段动画"
            >
              ▶️ 下一步
            </button>
          )}
        </div>
      </div>

      {/* 底部：使用提示 */}
      <div className="mt-2 pt-2 border-t border-purple-200">
        <p className="text-xs text-purple-600">
          💡 <strong>单步模式</strong>：单步展示通信过程 |
          <strong className="ml-2">快速模式</strong>：快速验证配置
        </p>
      </div>
    </div>
  );
};
