import React from 'react';

interface WelcomeGuideProps {
  onClose: () => void;
}

export const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ onClose }) => {
  const handleSkip = () => {
    localStorage.setItem('hasSeenWelcomeGuide', 'true');
    onClose();
  };

  const handleStart = () => {
    localStorage.setItem('hasSeenWelcomeGuide', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg">
          <h2 className="text-3xl font-bold mb-2">欢迎使用网络综合实验平台！</h2>
          <p className="text-blue-100">七年级信息科技 · 第二单元综合实验</p>
        </div>

        {/* 内容区 */}
        <div className="p-6 space-y-6">
          {/* 平台简介 */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <h3 className="font-bold text-lg mb-2 text-blue-900">平台简介</h3>
            <p className="text-gray-700">
              这是一个交互式网络拓扑模拟器，帮助你理解路由器、DNS、Web服务器的工作原理。
              通过搭建虚拟网络、配置路由表，你将深入掌握网络知识！
            </p>
          </div>

          {/* 核心操作 */}
          <div>
            <h3 className="font-bold text-lg mb-3 text-gray-800 flex items-center">
              <span className="mr-2">🎯</span>
              核心操作（必看！）
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 添加设备 */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">➕</span>
                  <h4 className="font-semibold text-green-900">添加设备</h4>
                </div>
                <p className="text-sm text-gray-700">点击"➕ 添加设备"按钮，选择PC、路由器、DNS或Web服务器</p>
              </div>

              {/* 连接设备 */}
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">🔗</span>
                  <h4 className="font-semibold text-yellow-900">连接设备（重要！）</h4>
                </div>
                <p className="text-sm text-gray-700">
                  <strong className="text-red-600">按住Shift键</strong>，依次点击两个设备即可连接
                </p>
              </div>

              {/* 查看设备 */}
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">👁️</span>
                  <h4 className="font-semibold text-purple-900">查看设备</h4>
                </div>
                <p className="text-sm text-gray-700">单击设备查看详情和路由表</p>
              </div>

              {/* 编辑设备 */}
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">✏️</span>
                  <h4 className="font-semibold text-orange-900">编辑设备</h4>
                </div>
                <p className="text-sm text-gray-700">双击设备编辑名称、IP地址等属性</p>
              </div>

              {/* 拖拽设备 */}
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">🖱️</span>
                  <h4 className="font-semibold text-indigo-900">拖拽设备</h4>
                </div>
                <p className="text-sm text-gray-700">按住设备拖动调整位置</p>
              </div>

              {/* 缩放画布 */}
              <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">🔍</span>
                  <h4 className="font-semibold text-pink-900">缩放画布</h4>
                </div>
                <p className="text-sm text-gray-700">鼠标滚轮上下滚动缩放视图</p>
              </div>
            </div>
          </div>

          {/* 快速提示 */}
          <div>
            <h3 className="font-bold text-lg mb-3 text-gray-800 flex items-center">
              <span className="mr-2">💡</span>
              快速提示
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span><strong>路由器互连</strong>时，系统会自动配置骨干网接口IP（10.0.X.0网段）</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span><strong>配置路由表</strong>：目标网络填网络号（如192.168.1.0），下一站填路由器名称（如R2）或"-"表示直连</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span><strong>删除连接</strong>：点击连接线中间的红色删除点</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span><strong>测试连通性</strong>：左下角有 Ping 工具和浏览器模拟器（DNS+HTTP）</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span><strong>保存配置</strong>：配置自动保存在浏览器中，刷新页面不会丢失</span>
              </li>
            </ul>
          </div>

          {/* 学习建议 */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
            <h3 className="font-bold text-lg mb-2 text-purple-900 flex items-center">
              <span className="mr-2">📚</span>
              学习建议
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              <strong>循序渐进：</strong>从简单网络开始（2个设备），逐步增加复杂度
            </p>
            <p className="text-sm text-gray-700">
              <strong>遇到问题：</strong>查看错误提示，使用Ping测试排查故障，或举手问老师
            </p>
          </div>
        </div>

        {/* 按钮区 */}
        <div className="bg-gray-50 p-6 rounded-b-lg flex justify-end space-x-4">
          <button
            onClick={handleSkip}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            跳过
          </button>
          <button
            onClick={handleStart}
            className="px-8 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg
                     hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg
                     transform hover:scale-105 transition-all"
          >
            开始使用 🚀
          </button>
        </div>
      </div>
    </div>
  );
};
