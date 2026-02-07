import React, { useEffect, useState } from 'react';

interface PacketAnimationProps {
  path: string[];
  devicePositions: Record<string, { x: number; y: number }>;
  onComplete: () => void;
}

export const PacketAnimation: React.FC<PacketAnimationProps> = ({ path, devicePositions, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (currentIndex >= path.length - 1) {
      setTimeout(onComplete, 500);
      return;
    }

    const currentDeviceId = path[currentIndex].toLowerCase();
    const nextDeviceId = path[currentIndex + 1].toLowerCase();

    const start = devicePositions[currentDeviceId] || { x: 0, y: 0 };
    const end = devicePositions[nextDeviceId] || { x: 0, y: 0 };

    // 中心偏移（设备节点大小的一半）
    const offset = 48;
    const startPos = { x: start.x + offset, y: start.y + offset };
    const endPos = { x: end.x + offset, y: end.y + offset };

    // 动画参数
    const duration = 1000; // 1秒
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
        requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          setCurrentIndex(currentIndex + 1);
        }, 200);
      }
    };

    animate();
  }, [currentIndex, path, devicePositions, onComplete]);

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="relative">
        {/* 数据包图标 */}
        <div className="w-8 h-8 bg-green-500 rounded-lg shadow-lg flex items-center justify-center animate-pulse">
          <span className="text-white text-xl">📦</span>
        </div>

        {/* 轨迹线（可选） */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                      w-12 h-12 border-2 border-green-300 rounded-full animate-ping opacity-75"></div>
      </div>
    </div>
  );
};
