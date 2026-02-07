import React from 'react';
import { Device } from '../types';

interface DeviceNodeProps {
  device: Device;
  onClick: () => void;
  isSelected: boolean;
}

export const DeviceNode: React.FC<DeviceNodeProps> = ({ device, onClick, isSelected }) => {
  const getIcon = () => {
    switch (device.type) {
      case 'router':
        return '🔀';
      case 'pc':
        return '💻';
      case 'server':
        return '🖥️';
      default:
        return '📦';
    }
  };

  const getBorderColor = () => {
    if (isSelected) return 'border-blue-500 border-4';
    return 'border-gray-300 border-2';
  };

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-24 h-24 rounded-lg bg-white shadow-md cursor-pointer hover:shadow-lg transition-all ${getBorderColor()}`}
    >
      <div className="text-4xl mb-1">{getIcon()}</div>
      <div className="text-sm font-bold">{device.name}</div>
      <div className="text-xs text-gray-500">{device.ip}</div>
    </div>
  );
};
