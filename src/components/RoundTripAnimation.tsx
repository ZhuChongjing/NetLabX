import React, { useEffect, useState, useRef } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';

interface RoundTripAnimationProps {
  requestPath: string[];
  responsePath: string[];
  devicePositions: Record<string, { x: number; y: number }>;
  requestLabel: string;
  responseLabel: string;
  animationType: 'dns' | 'http';
  onComplete: () => void;
  // HTTP状态信息（用于改变响应颜色）
  httpSuccess?: boolean;
  viewport: {
    scale: number;
    translateX: number;
    translateY: number;
  };
  animationMode: 'step' | 'normal' | 'fast';
  stepToken: number;
}

const RoundTripAnimationComponent: React.FC<RoundTripAnimationProps> = ({
  requestPath,
  responsePath,
  devicePositions,
  requestLabel,
  responseLabel,
  animationType,
  onComplete,
  httpSuccess,
  viewport,
  animationMode,
  stepToken
}) => {
  const { triggerAnimationComplete } = useNetworkStore();
  const [phase, setPhase] = useState<'request' | 'response'>('request');
  const [currentSegment, setCurrentSegment] = useState(0);
  const speedFactor =
    animationMode === 'fast' ? 0.4 :
    animationMode === 'step' ? 1.5 :
    1;
  const applySpeed = (value: number) => Math.max(60, value * speedFactor);

  // 初始化位置为第一个设备的位置（不是0,0）
  const getInitialPosition = () => {
    if (requestPath.length > 0) {
      const firstKey = requestPath[0].toLowerCase();
      const firstPos = devicePositions[firstKey];
      if (firstPos) {
        return firstPos;
      }
    }
    return { x: 0, y: 0 }; // 如果找不到，才用(0,0)
  };

  const [position, setPosition] = useState(getInitialPosition());
  const animationFrameRef = useRef<number>();
  const isAnimatingRef = useRef(false);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hasCompletedRef = useRef(false);
  const lastStepTokenRef = useRef(stepToken);

  // 使用 ref 保存初始路径，避免中途被修改
  const initialRequestPathRef = useRef(requestPath);
  const initialResponsePathRef = useRef(responsePath);
  const initialRequestLabelRef = useRef(requestLabel);
  const initialResponseLabelRef = useRef(responseLabel);

  const currentPath = phase === 'request' ? initialRequestPathRef.current : initialResponsePathRef.current;
  const currentLabel = phase === 'request' ? initialRequestLabelRef.current : initialResponseLabelRef.current;

  // 初始化日志（只在组件挂载时打印一次）
  useEffect(() => {
    console.log('🎬 RoundTripAnimation 初始化:', {
      animationType,
      requestPath: initialRequestPathRef.current,
      responsePath: initialResponsePathRef.current,
      devicePositionKeys: Object.keys(devicePositions)
    });

    // 检查每个路径节点
    initialRequestPathRef.current.forEach((nodeName, index) => {
      const key = nodeName.toLowerCase();
      if (!devicePositions[key]) {
        console.error(`❌ 请求路径节点 ${index}: "${nodeName}" (key: "${key}") 找不到位置`);
      } else {
        console.log(`✅ 请求路径节点 ${index}: "${nodeName}" → ${JSON.stringify(devicePositions[key])}`);
      }
    });

    // 注意：位置已经在useState初始化时设置好了，不需要在这里再设置

    // 组件卸载时只清理timeout，不执行回调
    return () => {
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
      // ❌ 不要在卸载时执行回调，因为组件可能因为重新渲染而卸载
      // 只有动画真正完成时才应该执行回调
    };
  }, []); // 只在挂载时执行一次

  // 根据动画类型和HTTP状态设置颜色
  const getColors = () => {
    if (animationType === 'dns') {
      return {
        request: { bg: 'bg-blue-500', border: 'border-blue-300', icon: '🔍' },
        response: { bg: 'bg-purple-500', border: 'border-purple-300', icon: '✅' }
      };
    } else {
      // HTTP动画：根据状态码改变响应颜色
      return {
        request: { bg: 'bg-green-500', border: 'border-green-300', icon: '📤' },
        response: httpSuccess
          ? { bg: 'bg-green-500', border: 'border-green-300', icon: '✅' }  // 成功：绿色
          : { bg: 'bg-red-500', border: 'border-red-300', icon: '❌' }     // 失败：红色
      };
    }
  };

  const currentColors = getColors()[phase];

  // 动画主逻辑
  useEffect(() => {
    if (animationMode === 'step') {
      return; // 单步模式下由 stepToken 驱动
    }
    // 防止重复触发
    if (isAnimatingRef.current) {
      return;
    }

    console.log(`🎯 动画段 ${phase} ${currentSegment}/${currentPath.length - 1}`);

    // 检查是否完成当前阶段
    if (currentSegment >= currentPath.length - 1) {
      if (phase === 'request') {
        // 请求阶段完成，切换到响应阶段
        console.log('✅ 请求阶段完成，切换到响应阶段');
        setTimeout(() => {
          setPhase('response');
          setCurrentSegment(0);
        }, applySpeed(200)); // 加快切换速度：500ms → 200ms
      } else {
        // 响应阶段完成，结束动画
        console.log('✅ 响应阶段完成，动画结束');
        completionTimeoutRef.current = setTimeout(() => {
          if (!hasCompletedRef.current) {
            hasCompletedRef.current = true;
            console.log('🎊 执行完成回调');
            onComplete();
            triggerAnimationComplete(); // 触发 store 的回调
          }
        }, applySpeed(200)); // 加快完成速度：500ms → 200ms
      }
      return;
    }

    const startDeviceName = currentPath[currentSegment];
    const endDeviceName = currentPath[currentSegment + 1];

    const startKey = startDeviceName.toLowerCase();
    const endKey = endDeviceName.toLowerCase();

    const startPos = devicePositions[startKey];
    const endPos = devicePositions[endKey];

    if (!startPos || !endPos) {
      console.error(`❌ 找不到设备位置: ${startDeviceName} 或 ${endDeviceName}`);
      // 跳过这一段
      setTimeout(() => {
        setCurrentSegment(currentSegment + 1);
      }, applySpeed(100));
      return;
    }

    console.log(`🚀 动画: ${startDeviceName}(${startPos.x},${startPos.y}) → ${endDeviceName}(${endPos.x},${endPos.y})`);

    // 标记正在动画
    isAnimatingRef.current = true;

    // 动画参数
    const duration = applySpeed(500); // 加快动画速度：800ms → 500ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 缓动函数（ease-in-out）
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const x = startPos.x + (endPos.x - startPos.x) * easeProgress;
      const y = startPos.y + (endPos.y - startPos.y) * easeProgress;

      setPosition({ x, y });

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // 当前段完成
        console.log(`✅ 段完成: ${startDeviceName} → ${endDeviceName}`);
        isAnimatingRef.current = false;
        setTimeout(() => {
          setCurrentSegment(currentSegment + 1);
        }, applySpeed(100));
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // 清理函数
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      isAnimatingRef.current = false;
    };
  }, [currentSegment, phase, animationMode]); // 只依赖 currentSegment、phase 与模式

  // 单步推进：每次 stepToken 变化推进一段（请求→响应）
  useEffect(() => {
    if (animationMode !== 'step') return;
    if (stepToken === lastStepTokenRef.current) return;
    lastStepTokenRef.current = stepToken;

    const path = phase === 'request' ? initialRequestPathRef.current : initialResponsePathRef.current;

    // 无路径或单节点，直接完成
    if (!path || path.length < 2) {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onComplete();
        triggerAnimationComplete();
      }
      return;
    }

    // 当前阶段结束，尝试切换或完成
    if (currentSegment >= path.length - 1) {
      if (phase === 'request' && initialResponsePathRef.current.length > 1) {
        // 切到响应阶段，并把位置放到响应起点
        setPhase('response');
        setCurrentSegment(0);
        const startKey = initialResponsePathRef.current[0]?.toLowerCase();
        const startPos = startKey ? devicePositions[startKey] : undefined;
        if (startPos) {
          setPosition(startPos);
        }
      } else {
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onComplete();
          triggerAnimationComplete();
        }
      }
      return;
    }

    // 正常前进一步
    const nextName = path[currentSegment + 1];
    const nextKey = nextName.toLowerCase();
    const nextPos = devicePositions[nextKey];
    if (nextPos) {
      setPosition(nextPos);
    }
    setCurrentSegment((seg) => seg + 1);
  }, [animationMode, stepToken, phase, currentSegment, devicePositions, onComplete, triggerAnimationComplete]);

  // 应用viewport变换，将设备坐标转换为屏幕坐标
  const screenX = position.x * viewport.scale + viewport.translateX;
  const screenY = position.y * viewport.scale + viewport.translateY;

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{
        left: `${screenX}px`,
        top: `${screenY}px`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="relative">
        {/* 数据包图标 */}
        <div className={`w-10 h-10 ${currentColors.bg} rounded-lg shadow-lg flex items-center justify-center animate-pulse`}>
          <span className="text-white text-xl">{currentColors.icon}</span>
        </div>

        {/* 标签 */}
        <div className={`absolute -top-8 left-1/2 transform -translate-x-1/2
                        px-2 py-1 ${currentColors.bg} text-white text-xs font-bold rounded whitespace-nowrap shadow-lg`}>
          {currentLabel}
        </div>

        {/* 轨迹线 */}
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                        w-14 h-14 border-2 ${currentColors.border} rounded-full animate-ping opacity-75`}></div>
      </div>
    </div>
  );
};

// 使用React.memo避免不必要的重新渲染
export const RoundTripAnimation = React.memo(RoundTripAnimationComponent);
