import { useEffect, useState, useCallback } from 'react';
import { useNetworkStore } from './store/useNetworkStore';
import { RoutingTableEditor } from './components/RoutingTableEditor';
import { DeviceEditor } from './components/DeviceEditor';
import { ControlPanel } from './components/ControlPanel';
import { AddDevicePanel } from './components/AddDevicePanel';
import { ConnectionManager } from './components/ConnectionManager';
import { InteractiveCanvas } from './components/InteractiveCanvas';
import { InterfaceManager } from './components/InterfaceManager';
import { DNSManager } from './components/DNSManager';
import { WebServerManager } from './components/WebServerManager';
import { BrowserSimulator } from './components/BrowserSimulator';
import { ScenarioSelector } from './components/ScenarioSelector';
import { GlobalAnimationControl } from './components/GlobalAnimationControl';
import { HTMLPreviewModal } from './components/HTMLPreviewModal';
import { WelcomeGuide } from './components/WelcomeGuide';
import { AssignmentSubmission } from './components/AssignmentSubmission';
import { AssignmentGrading } from './components/AssignmentGrading';
import { GradingPasswordDialog } from './components/GradingPasswordDialog';
import { APP_TITLE } from './config/version';

function App() {
  const {
    devices,
    selectedDevice,
    selectDevice,
    simulationResult,
    simulationType,
    currentStudentInfo
  } = useNetworkStore();

  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPath, setAnimationPath] = useState<string[]>([]);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const [showSubmission, setShowSubmission] = useState(false);
  const [showGrading, setShowGrading] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [isCanvasMaximized, setIsCanvasMaximized] = useState(false);
  const handleAnimationDone = useCallback(() => setIsAnimating(false), []);

  // 页面加载时检查是否需要显示欢迎引导
  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('hasSeenWelcomeGuide');
    if (!hasSeenGuide) {
      setShowWelcomeGuide(true);
    }
  }, []);

  // 当有新的模拟结果时，触发动画
  useEffect(() => {
    if (simulationResult && simulationResult.success && simulationResult.path.length > 0) {
      setAnimationPath(simulationResult.path);
      setIsAnimating(true);
    }
  }, [simulationResult]);

  const handleDeviceClick = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      selectDevice(device);
    }
  };

  const handleDeviceDoubleClick = (deviceId: string) => {
    setEditingDevice(deviceId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* 标题栏 */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {APP_TITLE}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              第二单元《直播网络我来建》· 支持路由器 + DNS + Web服务器
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowWelcomeGuide(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg
                       hover:bg-blue-600 font-semibold shadow-md
                       transform hover:scale-105 transition-all"
            >
              💡 使用帮助
            </button>
            <button
              onClick={() => setShowPasswordDialog(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg
                       hover:from-purple-700 hover:to-pink-700 font-bold shadow-lg
                       transform hover:scale-105 transition-all"
            >
              📊 批改作业
            </button>
            <button
              onClick={() => setShowSubmission(true)}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg
                       hover:from-green-700 hover:to-blue-700 font-bold shadow-lg
                       transform hover:scale-105 transition-all"
            >
              📝 提交作业
            </button>
          </div>
        </div>
      </header>

      {/* 学生作业信息横幅 */}
      {currentStudentInfo && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md">
          <div className={`mx-auto px-4 py-3 flex items-center justify-between transition-all duration-300 ${
            showGrading ? 'ml-80 max-w-6xl' : 'max-w-7xl'
          }`}>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="font-semibold">📋 当前作业:</span>
                <span className="font-bold text-lg">{currentStudentInfo.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>学号: {currentStudentInfo.studentId}</span>
                <span>班级: 七年级{currentStudentInfo.className}班</span>
                <span>IP: {currentStudentInfo.clientIP}</span>
                <span>提交时间: {new Date(currentStudentInfo.submitTime).toLocaleString('zh-CN')}</span>
              </div>
            </div>
            <button
              onClick={() => useNetworkStore.setState({ currentStudentInfo: null })}
              className="px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded transition-all text-sm"
              title="关闭学生信息"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 批改作业侧边栏 */}
      {showGrading && (
        <AssignmentGrading onClose={() => setShowGrading(false)} />
      )}

      {/* 主内容区 */}
      <div className={`mx-auto px-4 py-6 transition-all duration-300 ${
        showGrading ? 'ml-80 max-w-6xl' : 'max-w-7xl'
      }`}>
        {/* 顶部：场景选择器 */}
        <div className="mb-6">
          <ScenarioSelector />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：网络拓扑区 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">网络拓扑图</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAddDevice(true)}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors text-sm font-bold"
                  >
                    ➕ 添加设备
                  </button>
                  <button
                    onClick={() => setIsCanvasMaximized(true)}
                    className="px-3 py-1 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100 transition-colors font-semibold"
                  >
                    ⤢ 最大化画布
                  </button>
                </div>
              </div>

              {/* 拓扑显示区 - 使用交互式画布 */}
              <div className="h-[600px]">
              <InteractiveCanvas
                onDeviceClick={handleDeviceClick}
                onDeviceDoubleClick={handleDeviceDoubleClick}
                animationPath={isAnimating ? animationPath : []}
                animationType={isAnimating ? simulationType : null}
                onAnimationComplete={handleAnimationDone}
              />
              </div>

              {/* 使用说明 + 全局动画控制 - 并排布局 */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 左侧：交互操作提示 */}
                <div className="self-stretch p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-bold text-blue-800 mb-1">💡 交互操作：</p>
                  <ul className="text-blue-700 space-y-1 ml-4 list-disc">
                    <li><strong>拖动设备</strong>：左键拖拽设备到任意位置</li>
                    <li><strong>连接设备</strong>：按住 Shift + 点击两个设备创建连接</li>
                    <li><strong>删除连接</strong>：点击连接线中点删除</li>
                    <li><strong>查看路由表</strong>：单击设备查看详情</li>
                    <li><strong>编辑设备</strong>：双击设备编辑名称和IP</li>
                  </ul>
                </div>

                {/* 右侧：全局动画控制 */}
                <div className="self-stretch">
                  <div className="h-full">
                    <GlobalAnimationControl />
                  </div>
                </div>
              </div>
            </div>

            {/* 设备配置区 */}
            {selectedDevice && (
              <div className="mt-6 space-y-6">
                {/* 接口管理器 - 所有设备都有 */}
                <InterfaceManager device={selectedDevice} />

                {/* 路由表编辑器 - 仅路由器 */}
                {selectedDevice.type === 'router' && (
                  <RoutingTableEditor device={selectedDevice} />
                )}

                {/* DNS管理器 - 仅DNS服务器 */}
                {selectedDevice.type === 'dns' && (
                  <DNSManager device={selectedDevice} />
                )}

                {/* Web服务器管理器 - 仅Web服务器 */}
                {selectedDevice.type === 'web' && (
                  <WebServerManager device={selectedDevice} />
                )}
              </div>
            )}
          </div>

          {/* 右侧：控制面板 */}
          <div className="lg:col-span-1">
            {/* 控制面板 */}
            <ControlPanel />

            {/* 模拟浏览器 */}
            <div className="mt-6">
              <BrowserSimulator />
            </div>

            {/* 教学提示 */}
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-800 mb-2">📚 教学重点</h3>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• 路由器：为数据包指路</li>
                <li>• DNS服务器：域名转换为IP地址</li>
                <li>• Web服务器：提供网页内容</li>
                <li>• HTTP协议：浏览器与服务器通信</li>
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="mt-12 py-4 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>七年级信息科技 · 第二单元 · 直播网络我来建</p>
        </div>
      </footer>

      {/* 设备编辑器（模态框） */}
      {editingDevice && (
        <DeviceEditor
          device={devices.find(d => d.id === editingDevice)!}
          onClose={() => setEditingDevice(null)}
        />
      )}
      {isCanvasMaximized && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-y-auto">
          <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between shadow-lg">
            <div>
              <h2 className="text-xl font-bold">📽️ 画布演示模式</h2>
              <p className="text-sm text-gray-200">显示所有关键配置，便于课堂讲解</p>
            </div>
            <button
          onClick={() => setIsCanvasMaximized(false)}
          className="px-4 py-2 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
        >
          退出最大化
        </button>
      </div>
          <div className="flex-1 min-h-0 bg-gray-100 p-6 flex flex-col gap-4 overflow-hidden">
            {/* 全局动画控制（最大化模式也可操作单步/速度） */}
            <div className="flex-shrink-0">
              <GlobalAnimationControl />
            </div>

            {/* InteractiveCanvas - 自动填充剩余空间 */}
            <div className="flex-1 min-h-0 bg-white rounded-lg shadow-lg p-4">
              <InteractiveCanvas
                onDeviceClick={handleDeviceClick}
                onDeviceDoubleClick={handleDeviceDoubleClick}
                animationPath={isAnimating ? animationPath : []}
                animationType={isAnimating ? simulationType : null}
                onAnimationComplete={handleAnimationDone}
                showDeviceDetails
              />
            </div>
          </div>
        </div>
      )}

      {/* 添加设备面板 */}
      {showAddDevice && (
        <AddDevicePanel onClose={() => setShowAddDevice(false)} />
      )}

      {/* 连接管理器 */}
      {showConnectionManager && (
        <ConnectionManager onClose={() => setShowConnectionManager(false)} />
      )}

      {/* HTML预览模态框 */}
      <HTMLPreviewModal />

      {/* 欢迎引导 */}
      {showWelcomeGuide && (
        <WelcomeGuide onClose={() => setShowWelcomeGuide(false)} />
      )}

      {/* 作业提交 */}
      {showSubmission && (
        <AssignmentSubmission onClose={() => setShowSubmission(false)} />
      )}

      {/* 密码验证对话框 */}
      {showPasswordDialog && (
        <GradingPasswordDialog
          onSuccess={() => {
            setShowPasswordDialog(false);
            setShowGrading(true);
          }}
          onCancel={() => setShowPasswordDialog(false)}
        />
      )}
    </div>
  );
}

export default App;
