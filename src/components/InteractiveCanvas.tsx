import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { Device } from '../types';
import { RoundTripAnimation } from './RoundTripAnimation';

interface InteractiveCanvasProps {
  onDeviceClick: (deviceId: string) => void;
  onDeviceDoubleClick: (deviceId: string) => void;
  animationPath?: string[];
  animationType?: 'ping' | 'dns' | 'http' | null;
  onAnimationComplete?: () => void;
  showDeviceDetails?: boolean;
}

const DEVICE_VISUALS: Record<Device['type'], { fill: string; icon: string }> = {
  pc: { fill: '#dbeafe', icon: '💻' },
  router: { fill: '#dcfce7', icon: '🔀' },
  server: { fill: '#e0e7ff', icon: '🖥️' },
  dns: { fill: '#fef3c7', icon: '🔍' },
  web: { fill: '#fee2e2', icon: '🌐' }
};

const formatNetwork = (ip?: string): string => {
  if (!ip || !ip.includes('.')) return '未知网段';
  const parts = ip.split('.');
  if (parts.length !== 4) return '未知网段';
  return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
};

const getDeviceDetails = (device: Device): string[] => {
  switch (device.type) {
    case 'pc':
      return [
        `DNS: ${device.dnsServer || '未配置'}`
      ];
    case 'dns': {
      const records = device.dnsRecords || [];
      if (records.length === 0) {
        return ['DNS记录: 未配置'];
      }
      const recordLines = records.slice(0, 4).map(r => `${r.domain} → ${r.ip}`);
      if (records.length > 4) {
        recordLines.push(`... 共 ${records.length} 条`);
      }
      return recordLines;
    }
    case 'router': {
      const table = device.routingTable || [];
      const lines = [`LAN: ${formatNetwork(device.ip)}`];
      if (table.length === 0) {
        lines.push('路由表: 未配置');
      } else {
        const entries = table.slice(0, 4).map(entry => `${entry.destination} → ${entry.nextHop || '-'} (${entry.interface || ''})`);
        if (table.length > 4) {
          entries.push(`... 共 ${table.length} 条`);
        }
        lines.push(...entries);
      }
      return lines;
    }
    case 'web':
      return [
        `端口: ${device.port || 80}`
      ];
    case 'server':
    default:
      return [];
  }
};

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  onDeviceClick,
  onDeviceDoubleClick,
  animationPath = [],
  animationType = null,
  onAnimationComplete,
  showDeviceDetails = false
}) => {
  const {
    devices,
    connections,
    updateDevice,
    addConnection,
    deleteConnection,
    simulationResult,
    gradingTools,
    selectedDevice,
    selectDevice,
    stopSimulation
  } = useNetworkStore();

  // 缓存devicePositions，避免每次渲染都创建新对象
  const devicePositions = useMemo(() => {
    return devices.reduce((acc, d) => {
      acc[d.id.toLowerCase()] = d.position;
      acc[d.name.toLowerCase()] = d.position;
      return acc;
    }, {} as Record<string, { x: number; y: number }>);
  }, [devices]);

  // 缓存onComplete回调，避免每次渲染都创建新函数
  const handleAnimationComplete = useCallback(() => {
    // 动画完成后，结束模拟状态
    stopSimulation();
    if (onAnimationComplete) {
      onAnimationComplete();
    }
  }, [onAnimationComplete, stopSimulation]);

  // 缓存路径数组，避免引用变化导致重新渲染
  const cachedRequestPath = useMemo(() => simulationResult?.requestPath || [], [simulationResult?.requestPath?.join('-')]);
  const cachedResponsePath = useMemo(() => simulationResult?.responsePath || [], [simulationResult?.responsePath?.join('-')]);
  const cachedRequestLabel = useMemo(() => simulationResult?.requestLabel || '', [simulationResult?.requestLabel]);
  const cachedResponseLabel = useMemo(() => simulationResult?.responseLabel || '', [simulationResult?.responseLabel]);

  // 拖拽状态
  const [draggingDevice, setDraggingDevice] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 连接线绘制状态
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [tempLineEnd, setTempLineEnd] = useState<{ x: number; y: number } | null>(null);

  // 画布视口状态（缩放和平移）
  // 初始缩放0.65，靠左上显示，确保所有设备完整显示（设备范围: 45-755px宽, 45-515px高）
  const [viewport, setViewport] = useState({
    scale: 0.65,
    translateX: 40,
    translateY: 40
  });

  // 画布拖拽状态（中键或空格拖拽）
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const canvasRef = useRef<SVGSVGElement>(null);

  // 获取鼠标在SVG中的坐标（考虑视口变换）
  const getSVGPoint = (e: React.MouseEvent<SVGSVGElement> | React.MouseEvent): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // 反向应用视口变换，得到SVG坐标系中的真实坐标
    return {
      x: (clientX - viewport.translateX) / viewport.scale,
      y: (clientY - viewport.translateY) / viewport.scale
    };
  };

  // 处理设备鼠标按下（开始拖拽或连接）
  const handleDeviceMouseDown = (e: React.MouseEvent, device: Device) => {
    if (e.button !== 0) return; // 只响应左键

    // 检查是否按住Shift键（连接模式）
    if (e.shiftKey) {
      if (connectingFrom === null) {
        // 第一次Shift+点击：设置源设备
        setConnectingFrom(device.id);
      } else {
        // 第二次Shift+点击：创建连接
        if (connectingFrom !== device.id) {
          const existingConnection = connections.find(
            c => (c.source === connectingFrom && c.target === device.id) ||
                 (c.source === device.id && c.target === connectingFrom)
          );

          if (!existingConnection) {
            // 检查物理连接合法性
            const sourceDevice = devices.find(d => d.id === connectingFrom);
            const targetDevice = device;

            if (isPhysicalConnectionValid(sourceDevice!, targetDevice)) {
              addConnection({
                id: `conn-${Date.now()}`,
                source: connectingFrom,
                target: device.id
              });
            } else {
              alert('⚠️ 物理连接不合法：请确保设备在同一网段或通过合适的接口连接');
            }
          }
        }
        // 完成连接，重置状态
        setConnectingFrom(null);
        setTempLineEnd(null);
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // 普通拖拽模式
    const point = getSVGPoint(e);
    setDraggingDevice(device.id);
    setDragOffset({
      x: point.x - device.position.x,
      y: point.y - device.position.y
    });
    e.stopPropagation();
  };

  // 物理连接合法性检查
  const isPhysicalConnectionValid = (source: Device, target: Device): boolean => {
    // 检查IP网段
    const getNetwork = (ip: string) => {
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    };

    const sourceNet = getNetwork(source.ip);
    const targetNet = getNetwork(target.ip);

    // 1. 路由器之间可以跨网段连接（骨干网）
    if (source.type === 'router' && target.type === 'router') {
      return true;
    }

    // 2. PC之间只能在同一网段连接
    if (source.type === 'pc' && target.type === 'pc') {
      return sourceNet === targetNet;
    }

    // 3. PC连接路由器：必须在同一网段
    if (source.type === 'pc' && target.type === 'router') {
      return target.interfaces?.some(iface => getNetwork(iface.ip) === sourceNet) || false;
    }

    if (source.type === 'router' && target.type === 'pc') {
      return source.interfaces?.some(iface => getNetwork(iface.ip) === targetNet) || false;
    }

    // 4. DNS服务器连接
    if (source.type === 'dns' || target.type === 'dns') {
      const dnsDevice = source.type === 'dns' ? source : target;
      const otherDevice = source.type === 'dns' ? target : source;
      const dnsNet = getNetwork(dnsDevice.ip);
      const otherNet = getNetwork(otherDevice.ip);

      // DNS可以连接到路由器（任意网段）
      if (otherDevice.type === 'router') {
        return otherDevice.interfaces?.some(iface => getNetwork(iface.ip) === dnsNet) || false;
      }
      // DNS连接PC/其他服务器：必须同网段
      return dnsNet === otherNet;
    }

    // 5. Web服务器连接
    if (source.type === 'web' || target.type === 'web') {
      const webDevice = source.type === 'web' ? source : target;
      const otherDevice = source.type === 'web' ? target : source;
      const webNet = getNetwork(webDevice.ip);
      const otherNet = getNetwork(otherDevice.ip);

      // Web可以连接到路由器（任意网段）
      if (otherDevice.type === 'router') {
        return otherDevice.interfaces?.some(iface => getNetwork(iface.ip) === webNet) || false;
      }
      // Web连接PC/其他服务器：必须同网段
      return webNet === otherNet;
    }

    return true;
  };

  // 处理设备点击
  const handleDeviceClick = (e: React.MouseEvent, deviceId: string) => {
    // 阻止事件冒泡到画布，避免触发取消选中
    e.stopPropagation();

    // 如果不是Shift键，正常点击查看详情
    if (!e.shiftKey && !connectingFrom) {
      onDeviceClick(deviceId);
    }
  };

  // 键盘事件监听（空格键）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setIsPanning(false);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  // 滚轮事件监听（原生事件，阻止浏览器滚动）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault(); // 阻止浏览器默认滚动行为
      e.stopPropagation();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.3, Math.min(3, viewport.scale + delta));

      // 以鼠标位置为中心缩放
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldWorldX = (mouseX - viewport.translateX) / viewport.scale;
      const oldWorldY = (mouseY - viewport.translateY) / viewport.scale;

      const newTranslateX = mouseX - oldWorldX * newScale;
      const newTranslateY = mouseY - oldWorldY * newScale;

      setViewport({
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY,
      });
    };

    // 使用 passive: false 确保可以阻止默认行为
    canvas.addEventListener('wheel', handleWheelNative, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheelNative);
    };
  }, [viewport]);

  // 处理画布鼠标按下（开始平移）
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // 中键拖拽画布
    if (e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    // 左键点击空白处拖拽画布（不在设备上）
    if (e.button === 0 && e.target === canvasRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  // 处理画布鼠标移动
  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // 画布拖拽
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;

      setViewport(prev => ({
        ...prev,
        translateX: prev.translateX + dx,
        translateY: prev.translateY + dy
      }));

      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    const point = getSVGPoint(e);

    if (draggingDevice) {
      // 拖拽设备
      const newX = point.x - dragOffset.x;
      const newY = point.y - dragOffset.y;

      updateDevice(draggingDevice, {
        position: { x: newX, y: newY }
      });
    } else if (connectingFrom && e.shiftKey) {
      // 绘制临时连接线（只在按住Shift时）
      setTempLineEnd(point);
    }
  };

  // 处理鼠标释放
  const handleCanvasMouseUp = () => {
    setDraggingDevice(null);
    setIsPanning(false);
  };

  // 处理画布点击（取消连接模式 + 取消选中设备）
  const handleCanvasClick = (e: React.MouseEvent) => {
    // 取消连接模式
    if (connectingFrom && !e.shiftKey) {
      setConnectingFrom(null);
      setTempLineEnd(null);
    }

    // 点击空白区域取消选中设备
    // 检查点击目标是否为SVG根元素或内部的g元素（即非设备、非连接线）
    const target = e.target as SVGElement;
    const tagName = target.tagName?.toLowerCase();
    const isBackgroundClick = target === canvasRef.current || tagName === 'g' || tagName === 'svg';

    if (isBackgroundClick) {
      selectDevice(null);
    }
  };

  // 处理连接线点击（删除）
  const handleConnectionClick = (e: React.MouseEvent, connectionId: string) => {
    e.stopPropagation();
    if (confirm('确定删除这条连接？')) {
      deleteConnection(connectionId);
    }
  };

  // 检查连接是否在动画路径中
  const isConnectionActive = (sourceId: string, targetId: string): boolean => {
    if (animationPath.length === 0) return false;

    const sourceName = devices.find(d => d.id === sourceId)?.name.toLowerCase() || '';
    const targetName = devices.find(d => d.id === targetId)?.name.toLowerCase() || '';

    for (let i = 0; i < animationPath.length - 1; i++) {
      const current = animationPath[i].toLowerCase();
      const next = animationPath[i + 1].toLowerCase();

      if ((current === sourceName && next === targetName) ||
          (current === targetName && next === sourceName)) {
        return true;
      }
    }

    return false;
  };

  // 重置视口
  const resetViewport = () => {
    setViewport({ scale: 0.65, translateX: 40, translateY: 40 });
  };

  // 缩放控制
  const zoomIn = () => {
    setViewport(prev => ({
      ...prev,
      scale: Math.min(5, prev.scale * 1.2)
    }));
  };

  const zoomOut = () => {
    setViewport(prev => ({
      ...prev,
      scale: Math.max(0.1, prev.scale / 1.2)
    }));
  };

  // 自动适配
  const handleAutoLayout = () => {
    // 获取画布实际尺寸
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;

    console.log('📐 画布实际尺寸:', { canvasWidth, canvasHeight });

    const { autoLayout } = useNetworkStore.getState();
    const newViewport = autoLayout(canvasWidth, canvasHeight);
    setViewport(newViewport);
  };

  return (
    <div className="relative w-full h-full bg-gray-50 rounded-lg border-2 border-gray-300 overflow-hidden">
      {/* 缩放控制 */}
      <div className="absolute bottom-3 right-3 bg-white bg-opacity-90 rounded shadow-md p-1.5 z-20 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-bold text-sm"
          title="放大"
        >
          +
        </button>
        <div className="text-center text-[10px] font-mono text-gray-600 px-1">
          {Math.round(viewport.scale * 100)}%
        </div>
        <button
          onClick={zoomOut}
          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors font-bold text-sm"
          title="缩小"
        >
          −
        </button>
        <button
          onClick={resetViewport}
          className="px-2 py-0.5 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-[10px]"
          title="重置视图"
        >
          ⟲
        </button>
        <button
          onClick={handleAutoLayout}
          className="px-2 py-0.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-xs"
          title="自动适配 - 缩放画布以显示所有设备"
        >
          📐
        </button>
      </div>

      {/* 连接模式提示 */}
      {connectingFrom && (
        <div className="absolute top-2 right-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-bold z-10 animate-pulse">
          🔗 连接模式：按住Shift点击目标设备
        </div>
      )}

      <svg
        ref={canvasRef}
        className={`w-full h-full ${isPanning || isSpacePressed ? 'cursor-grab' : 'cursor-default'}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onClick={handleCanvasClick}
      >
        {/* 应用视口变换 */}
        <g transform={`translate(${viewport.translateX}, ${viewport.translateY}) scale(${viewport.scale})`}>
          {/* 绘制连接线 */}
          {connections.map(conn => {
            const source = devices.find(d => d.id === conn.source);
            const target = devices.find(d => d.id === conn.target);

            if (!source || !target) return null;

            const isActive = isConnectionActive(conn.source, conn.target);

            return (
              <g key={conn.id}>
                {/* 连接线 */}
                <line
                  x1={source.position.x}
                  y1={source.position.y}
                  x2={target.position.x}
                  y2={target.position.y}
                  stroke={isActive ? '#10b981' : '#9ca3af'}
                  strokeWidth={isActive ? '4' : '2'}
                  className={`transition-all cursor-pointer hover:stroke-red-500 ${
                    isActive ? 'path-highlight' : ''
                  }`}
                  onClick={(e) => handleConnectionClick(e, conn.id)}
                />
                {/* 连接线中点（可点击区域） */}
                <circle
                  cx={(source.position.x + target.position.x) / 2}
                  cy={(source.position.y + target.position.y) / 2}
                  r="10"
                  fill="transparent"
                  className="cursor-pointer hover:fill-red-300 hover:fill-opacity-50"
                  onClick={(e) => handleConnectionClick(e, conn.id)}
                />
              </g>
            );
          })}

          {/* 临时连接线（正在绘制） */}
          {connectingFrom && tempLineEnd && (
            <line
              x1={devices.find(d => d.id === connectingFrom)?.position.x || 0}
              y1={devices.find(d => d.id === connectingFrom)?.position.y || 0}
              x2={tempLineEnd.x}
              y2={tempLineEnd.y}
              stroke="#3b82f6"
              strokeWidth="3"
              strokeDasharray="8,4"
              className="pointer-events-none"
            />
          )}

          {/* 绘制设备 */}
          {devices.map(device => {
            const { fill, icon } = DEVICE_VISUALS[device.type];
            const isSelected = selectedDevice?.id === device.id;
            return (
              <g
                key={device.id}
                transform={`translate(${device.position.x}, ${device.position.y})`}
                onMouseDown={(e) => handleDeviceMouseDown(e, device)}
                onClick={(e) => handleDeviceClick(e, device.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDeviceDoubleClick(device.id);
                }}
                className={`cursor-move ${draggingDevice === device.id ? 'opacity-70' : ''} ${
                  connectingFrom === device.id ? 'animate-pulse' : ''
                }`}
              >
                {/* 设备背景 */}
                <circle
                  r="35"
                  fill={fill}
                  stroke={isSelected ? '#f97316' : connectingFrom === device.id ? '#3b82f6' : '#6b7280'}
                  strokeWidth={isSelected ? '5' : connectingFrom === device.id ? '4' : '2'}
                  className="transition-all hover:stroke-blue-500 hover:stroke-width-3"
                  style={isSelected ? { filter: 'drop-shadow(0 0 10px rgba(249,115,22,0.7))' } : undefined}
                />

                {/* 设备图标 */}
                <text
                  y="8"
                  fontSize="32"
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {icon}
                </text>

                {/* 设备名称 */}
                <text
                  y="55"
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                  fill="#1f2937"
                  className="pointer-events-none select-none"
                >
                  {device.name}
                </text>

                {/* 设备IP */}
                <text
                  y="70"
                  fontSize="11"
                  textAnchor="middle"
                  fill="#6b7280"
                  className="pointer-events-none select-none"
                >
                  {device.ip}
                </text>

                {/* 详细信息 */}
                {showDeviceDetails &&
                  (() => {
                    const details = getDeviceDetails(device);
                    if (details.length === 0) return null;
                    const detailHeight = Math.max(50, details.length * 14);
                    return (
                      <foreignObject
                        x={-85}
                        y={82}
                        width={170}
                        height={detailHeight}
                        style={{ pointerEvents: 'none' }}
                      >
                        <div className="bg-white/95 border border-gray-300 rounded-md p-1.5 text-[10px] leading-tight text-gray-700 shadow-sm">
                          {details.map((line, idx) => (
                            <div key={idx} className="truncate">
                              {line}
                            </div>
                          ))}
                        </div>
                      </foreignObject>
                    );
                  })()}
              </g>
            );
          })}

          {/* 动画效果：Ping (SVG动画) */}
          {animationType === 'ping' && animationPath.length > 0 && (
            <AnimatedPacket
              path={animationPath}
              devices={devices}
              animationMode={gradingTools.animationMode || (gradingTools.fastMode ? 'fast' : 'normal')}
              stepToken={gradingTools.stepToken || 0}
              onComplete={handleAnimationComplete}
            />
          )}
        </g>
      </svg>

      {/* 双向动画：DNS和HTTP (DOM动画) */}
      {(() => {
        // 检查条件：必须有animationType、是DNS或HTTP、有roundTrip数据、并且requestPath有内容
        if (!animationType ||
            (animationType !== 'dns' && animationType !== 'http') ||
            !simulationResult?.isRoundTrip ||
            !simulationResult?.requestPath ||
            simulationResult.requestPath.length === 0) {
          return null;
        }

        const animationKey = `${animationType}-${simulationResult.requestPath?.join('-') || ''}`;
        console.log(`🔑 渲染动画组件，key: ${animationKey}`);

        return (
          <RoundTripAnimation
            key={animationKey}
            requestPath={cachedRequestPath}
            responsePath={cachedResponsePath}
            devicePositions={devicePositions}
            requestLabel={cachedRequestLabel}
            responseLabel={cachedResponseLabel}
            animationType={animationType}
            onComplete={handleAnimationComplete}
            httpSuccess={simulationResult.httpSuccess}
            viewport={viewport}
            animationMode={gradingTools.animationMode || (gradingTools.fastMode ? 'fast' : 'normal')}
            stepToken={gradingTools.stepToken || 0}
          />
        );
      })()}

      {/* 空状态提示 */}
      {devices.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-400">
            <p className="text-lg font-bold mb-2">网络拓扑图为空</p>
            <p className="text-sm">点击 "➕ 添加设备" 开始构建网络</p>
          </div>
        </div>
      )}
    </div>
  );
};

// 动画数据包组件 - 完全重写
interface AnimatedPacketProps {
  path: string[];
  devices: Device[];
  onComplete?: () => void;
  animationMode: 'step' | 'normal' | 'fast';
  stepToken: number;
}

const AnimatedPacket: React.FC<AnimatedPacketProps> = ({ path, devices, onComplete, animationMode, stepToken }) => {
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isReturning, setIsReturning] = useState(false);
  const animationRef = useRef<number>();
  const lastStepTokenRef = useRef<number>(stepToken);
  const applySpeed = (base: number) => {
    if (animationMode === 'fast') return Math.max(50, base * 0.4);
    return base;
  };

  useEffect(() => {
    console.log('[AnimatedPacket] init/reset', { animationMode, path, stepToken });
    setSegmentIndex(0);
    setIsReturning(false);
    if (path.length > 0 && devices.length > 0) {
      const firstDeviceName = path[0].toLowerCase();
      const firstDevice = devices.find(d =>
        d.id.toLowerCase() === firstDeviceName ||
        d.name.toLowerCase() === firstDeviceName
      );
      if (firstDevice) {
        setPosition({ x: firstDevice.position.x, y: firstDevice.position.y });
      }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [path, devices, animationMode]);

  // 非单步动画
  useEffect(() => {
    if (animationMode === 'step') return;
    if (path.length < 2) return;
    const currentPath = isReturning ? [...path].reverse() : path;

    if (segmentIndex >= currentPath.length - 1) {
      if (!isReturning) {
        setIsReturning(true);
        setSegmentIndex(0);
        return;
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (onComplete) setTimeout(onComplete, 200);
      return;
    }

    const startName = currentPath[segmentIndex].toLowerCase();
    const endName = currentPath[segmentIndex + 1].toLowerCase();

    const startDevice = devices.find(d =>
      d.id.toLowerCase() === startName ||
      d.name.toLowerCase() === startName
    );
    const endDevice = devices.find(d =>
      d.id.toLowerCase() === endName ||
      d.name.toLowerCase() === endName
    );

    if (!startDevice || !endDevice) {
      setSegmentIndex(prev => prev + 1);
      return;
    }

    const duration = 600;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / applySpeed(duration), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const x = startDevice.position.x + (endDevice.position.x - startDevice.position.x) * eased;
      const y = startDevice.position.y + (endDevice.position.y - startDevice.position.y) * eased;
      setPosition({ x, y });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          setSegmentIndex(prev => prev + 1);
        }, applySpeed(60));
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [segmentIndex, isReturning, path, devices, onComplete, animationMode]);

  // 单步推进：每次stepToken变化推进一段
  useEffect(() => {
    if (animationMode !== 'step') return;
    if (stepToken === lastStepTokenRef.current) return;
    lastStepTokenRef.current = stepToken;
    if (path.length < 2) return;
    const currentPath = isReturning ? [...path].reverse() : path;

    if (segmentIndex >= currentPath.length - 1) {
      if (!isReturning) {
        setIsReturning(true);
        setSegmentIndex(0);
        return;
      }
      console.log('[AnimatedPacket] step complete (return done)');
      if (onComplete) onComplete();
      return;
    }

    const endName = currentPath[segmentIndex + 1].toLowerCase();
    const endDevice = devices.find(d =>
      d.id.toLowerCase() === endName ||
      d.name.toLowerCase() === endName
    );
    if (endDevice) {
      setPosition({ x: endDevice.position.x, y: endDevice.position.y });
    }
    console.log('[AnimatedPacket] step move', {
      segmentIndex,
      nextIndex: segmentIndex + 1,
      endName,
      isReturning
    });
    setSegmentIndex(prev => prev + 1);
  }, [stepToken, animationMode, path, devices, isReturning, segmentIndex, onComplete]);

  // 渲染数据包
  const packetColor = isReturning ? '#22c55e' : '#3b82f6';
  const packetSize = 14;

  return (
    <g>
      {/* 数据包主体 */}
      <circle
        cx={position.x}
        cy={position.y}
        r={packetSize}
        fill={packetColor}
        opacity="0.9"
      >
        <animate
          attributeName="opacity"
          values="0.9;0.5;0.9"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </circle>

      {/* 数据包光晕 */}
      <circle
        cx={position.x}
        cy={position.y}
        r={packetSize + 8}
        fill={packetColor}
        opacity="0.2"
      >
        <animate
          attributeName="r"
          values={`${packetSize + 8};${packetSize + 16};${packetSize + 8}`}
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.3;0.1;0.3"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>

      {/* 类型标识 */}
      <text
        x={position.x}
        y={position.y + 35}
        fontSize="11"
        fontWeight="bold"
        textAnchor="middle"
        fill={packetColor}
        style={{ textShadow: '0 0 3px white' }}
      >
        {isReturning ? '⬅ 应答' : '➡ 数据'}
      </text>
    </g>
  );
};
