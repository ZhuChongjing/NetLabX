import { create } from 'zustand';
import { Device, Connection, SimulationResult, RouteEntry, DeviceType, NetworkInterface } from '../types';
import { calculateSubnet } from '../utils/subnetUtils';

const DEFAULT_SUBNET_MASK = '255.255.255.0';
const BACKBONE_MASK = '255.255.255.0';
const BACKBONE_PREFIX_PARTS = ['10', '0'];
const ENDPOINT_TYPES: DeviceType[] = ['pc', 'dns', 'web'];

const deriveSubnet = (ip: string, mask: string = DEFAULT_SUBNET_MASK): string => {
  const calculated = calculateSubnet(ip, mask);
  if (calculated) return calculated;
  const parts = ip.split('.');
  if (parts.length >= 3) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return '0.0.0.0';
};

const isEndpointDevice = (device: Device) => ENDPOINT_TYPES.includes(device.type);
const isRouterDevice = (device: Device) => device.type === 'router';
const getLanInterface = (device: Device) => device.interfaces?.find((iface) => iface.name === 'LAN');
const isInSameSubnetHelper = (ip1: string, mask: string, ip2: string) =>
  deriveSubnet(ip1, mask) === deriveSubnet(ip2, mask);

const ensureRouterLanInterface = (device: Device): Device => {
  if (!isRouterDevice(device)) {
    return device;
  }

  const interfaces = device.interfaces ? device.interfaces.map((iface) => ({ ...iface })) : [];
  const lanIndex = interfaces.findIndex((iface) => iface.name === 'LAN');
  const fallbackIP = device.ip && device.ip !== '' ? device.ip : '192.168.1.1';

  if (lanIndex >= 0) {
    const lanIface = interfaces[lanIndex];
    const lanIP = lanIface.ip && lanIface.ip !== '' ? lanIface.ip : fallbackIP;
    const mask = lanIface.subnetMask || DEFAULT_SUBNET_MASK;
    interfaces[lanIndex] = {
      ...lanIface,
      ip: lanIP,
      subnetMask: mask,
      subnet: lanIface.subnet || deriveSubnet(lanIP, mask)
    };
    return {
      ...device,
      ip: device.ip || lanIP,
      interfaces
    };
  }

  const lanInterface = {
    id: `${device.id}-lan`,
    name: 'LAN',
    ip: fallbackIP,
    subnetMask: DEFAULT_SUBNET_MASK,
    subnet: deriveSubnet(fallbackIP, DEFAULT_SUBNET_MASK)
  };

  return {
    ...device,
    ip: fallbackIP,
    interfaces: [lanInterface, ...interfaces]
  };
};

const normalizeDevices = (devices: Device[] = []): Device[] =>
  devices.map((device) => ensureRouterLanInterface(device));

const collectUsedBackboneIndices = (devices: Device[]): Set<number> => {
  const used = new Set<number>();
  devices.forEach((device) => {
    if (!isRouterDevice(device)) return;
    device.interfaces?.forEach((iface) => {
      if (!iface.ip || iface.name === 'LAN') return;
      const parts = iface.ip.split('.');
      if (parts.length < 3) return;
      if (parts[0] === BACKBONE_PREFIX_PARTS[0] && parts[1] === BACKBONE_PREFIX_PARTS[1]) {
        const idx = Number(parts[2]);
        if (!Number.isNaN(idx)) {
          used.add(idx);
        }
      }
    });
  });
  return used;
};

const allocateBackboneNetwork = (devices: Device[]) => {
  const used = collectUsedBackboneIndices(devices);
  let index = 0;
  while (used.has(index)) {
    index++;
  }
  const subnet = `${BACKBONE_PREFIX_PARTS[0]}.${BACKBONE_PREFIX_PARTS[1]}.${index}.0`;
  return {
    subnet,
    sourceIP: `${BACKBONE_PREFIX_PARTS[0]}.${BACKBONE_PREFIX_PARTS[1]}.${index}.1`,
    targetIP: `${BACKBONE_PREFIX_PARTS[0]}.${BACKBONE_PREFIX_PARTS[1]}.${index}.2`
  };
};

const generateInterfaceId = (device: Device, name: string) =>
  `${device.id}-${name}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const nextEthName = (device: Device): string => {
  let index = 1;
  while (device.interfaces?.some((iface) => iface.name === `eth${index}`)) {
    index++;
  }
  return `eth${index}`;
};

const createRouterInterface = (
  device: Device,
  name: string,
  ip: string,
  subnet: string
): NetworkInterface => ({
  id: generateInterfaceId(device, name),
  name,
  ip,
  subnet,
  subnetMask: BACKBONE_MASK
});

interface StudentInfo {
  name: string;
  studentId: string;
  className: string;
  submitTime: string;
  clientIP: string;
}

interface NetworkState {
  devices: Device[];
  connections: Connection[];
  selectedDevice: Device | null;
  simulationResult: SimulationResult | null;
  isSimulating: boolean;
  simulationType: 'ping' | 'dns' | 'http' | null;
  animationCompleteCallback: (() => void) | null;
  htmlPreviewContent: { content: string; url: string; port: number } | null; // 要预览的HTML内容和访问信息
  currentStudentInfo: StudentInfo | null; // 当前加载的学生作业信息
  testToolState: { sourceIP: string; destIP: string }; // 测试工具状态（Ping）
  browserState: { sourceIP: string; url: string; port: number; dnsServerIP: string; urlType: 'domain' | 'ip' }; // 浏览器模拟器状态
  gradingTools: {
    fastMode: boolean;
  animationMode: 'step' | 'normal' | 'fast';
    stepToken: number;
    autoCommentEnabled: boolean;
    autoCommentDraft: string;
    lastAutoCommentSource: 'ping' | 'dns' | 'http' | null;
    lastUpdatedAt: number;
    activeStudentId: string | null;
    commentOwnerId: string | null;
  };
  setTestToolState: (state: { sourceIP: string; destIP: string }) => void;
  setBrowserState: (state: { sourceIP: string; url: string; port: number; dnsServerIP: string; urlType: 'domain' | 'ip' }) => void;
  setGradingFastMode: (enabled: boolean) => void;
  setAnimationMode: (mode: 'step' | 'normal' | 'fast') => void;
  stepForward: () => void;
  setGradingAutoCommentEnabled: (enabled: boolean) => void;
  setActiveGradingStudent: (studentId: string | null) => void;
  recordAutoComment: (type: 'ping' | 'dns' | 'http', result: SimulationResult) => void;

  // Actions
  addDevice: (device: Device) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  deleteDevice: (id: string) => void;
  selectDevice: (device: Device | null) => void;

  addConnection: (connection: Connection) => void;
  deleteConnection: (id: string) => void;

  simulatePing: (sourceIP: string, destIP: string) => void;
  simulateDNSQuery: (sourceIP: string, dnsServerIP: string, domain: string, onComplete?: () => void) => void;
  simulateHTTPRequest: (sourceIP: string, targetIP: string, httpSuccess: boolean, statusCode: number, onComplete?: () => void, httpMessage?: string) => void;
  clearSimulation: () => void;
  stopSimulation: () => void;
  setAnimationCompleteCallback: (callback: (() => void) | null) => void;
  triggerAnimationComplete: () => void;
  setHTMLPreviewContent: (content: { content: string; url: string; port: number } | null) => void; // 设置预览内容

  clearTopology: () => void;
  exportTopology: () => string;
  importTopology: (jsonData: string) => void;
  autoLayout: (canvasWidth: number, canvasHeight: number) => { scale: number; translateX: number; translateY: number };
}

// LocalStorage持久化
const STORAGE_KEY = 'network-simulator-state';
const VERSION_KEY = 'network-simulator-version';
const CURRENT_VERSION = '2.8.0';

// 从LocalStorage加载状态
const loadFromStorage = (): { devices: Device[], connections: Connection[] } => {
  try {
    // 检查版本号，如果版本变化则清除缓存
    const savedVersion = localStorage.getItem(VERSION_KEY);
    if (savedVersion !== CURRENT_VERSION) {
      console.log(`🔄 版本升级: ${savedVersion || '未知'} → ${CURRENT_VERSION}, 清除旧数据`);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      return { devices: [], connections: [] };
    }

    const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('📂 从LocalStorage加载配置:', parsed);
        return {
          devices: normalizeDevices(parsed.devices || []),
          connections: parsed.connections || []
        };
      }
  } catch (error) {
    console.error('❌ 加载配置失败:', error);
  }
  return { devices: [], connections: [] };
};

// 保存到LocalStorage
const saveToStorage = (devices: Device[], connections: Connection[]) => {
  try {
    const data = { devices, connections };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('💾 已保存配置到LocalStorage');
  } catch (error) {
    console.error('❌ 保存配置失败:', error);
  }
};

export const useNetworkStore = create<NetworkState>((set, get) => {
  const initialState = loadFromStorage();

  return {
  devices: initialState.devices,
  connections: initialState.connections,
  selectedDevice: null,
  simulationResult: null,
  isSimulating: false,
  simulationType: null,
  animationCompleteCallback: null,
  htmlPreviewContent: null,
  currentStudentInfo: null,
  testToolState: { sourceIP: '', destIP: '' }, // 默认测试工具状态
  browserState: { sourceIP: '', url: '', port: 80, dnsServerIP: '', urlType: 'domain' }, // 默认浏览器状态
  gradingTools: {
    fastMode: false,
    animationMode: 'normal',
    stepToken: 0,
    autoCommentEnabled: true,
    autoCommentDraft: '',
    lastAutoCommentSource: null,
    lastUpdatedAt: 0,
    activeStudentId: null,
    commentOwnerId: null
  },

  setTestToolState: (state) => set({ testToolState: state }),
  setBrowserState: (state) => set({ browserState: state }),
  setGradingFastMode: (enabled) => {
    set((state) => ({
      gradingTools: {
        ...state.gradingTools,
        fastMode: enabled,
        animationMode: enabled ? 'fast' : 'normal'
      }
    }));
  },
  setAnimationMode: (mode) => {
    set((state) => ({
      gradingTools: {
        ...state.gradingTools,
        animationMode: mode,
        fastMode: mode === 'fast'
      }
    }));
  },
  stepForward: () => {
    set((state) => ({
      gradingTools: {
        ...state.gradingTools,
        stepToken: state.gradingTools.stepToken + 1
      }
    }));
  },
  setGradingAutoCommentEnabled: (enabled) => {
    set((state) => ({
      gradingTools: {
        ...state.gradingTools,
        autoCommentEnabled: enabled
      }
    }));
  },
  setActiveGradingStudent: (studentId) => {
    set((state) => ({
      gradingTools: {
        ...state.gradingTools,
        activeStudentId: studentId
      }
    }));
  },
  recordAutoComment: (type, result) => {
    set((state) => {
      if (!state.gradingTools.autoCommentEnabled) {
        return {};
      }

      const ownerId = state.gradingTools.activeStudentId || state.currentStudentInfo?.studentId;
      if (!ownerId) {
        return {};
      }

      const text = formatAutoComment(type, result);
      return {
        gradingTools: {
          ...state.gradingTools,
          autoCommentDraft: text,
          lastAutoCommentSource: type,
          lastUpdatedAt: Date.now(),
          commentOwnerId: ownerId
        }
      };
    });
  },

  addDevice: (device) => {
    set((state) => {
      const newDevices = [...state.devices, device];
      saveToStorage(newDevices, state.connections);
      return { devices: newDevices };
    });
  },

  updateDevice: (id, updates) => {
    set((state) => {
      const newDevices = state.devices.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      );
      saveToStorage(newDevices, state.connections);

      // ✅ 修复：如果更新的设备是当前选中的设备，同步更新 selectedDevice
      const updatedSelectedDevice =
        state.selectedDevice && state.selectedDevice.id === id
          ? { ...state.selectedDevice, ...updates }
          : state.selectedDevice;

      return {
        devices: newDevices,
        selectedDevice: updatedSelectedDevice
      };
    });
  },

  deleteDevice: (id) => {
    set((state) => {
      const newDevices = state.devices.filter((d) => d.id !== id);
      const newConnections = state.connections.filter(
        (c) => c.source !== id && c.target !== id
      );
      saveToStorage(newDevices, newConnections);
      return {
        devices: newDevices,
        connections: newConnections
      };
    });
  },

  selectDevice: (device) => {
    set({ selectedDevice: device });
  },

  addConnection: (connection) => {
    set((state) => {
      const { devices, connections } = state;
      const sourceDevice = devices.find((d) => d.id === connection.source);
      const targetDevice = devices.find((d) => d.id === connection.target);

      if (!sourceDevice || !targetDevice) {
        return state;
      }

      const duplicateConnection = connections.some(
        (conn) =>
          (conn.source === connection.source && conn.target === connection.target) ||
          (conn.source === connection.target && conn.target === connection.source)
      );
      if (duplicateConnection) {
        alert('⚠️ 这两台设备已经连接，无需重复连线。');
        return state;
      }

      if (!isRouterDevice(sourceDevice) && !isRouterDevice(targetDevice)) {
        alert('⚠️ 终端设备之间不能直接连线，请通过路由器连接。');
        return state;
      }

      if (isEndpointDevice(sourceDevice) || isEndpointDevice(targetDevice)) {
        const ipMap = new Map<string, string[]>();
        devices.forEach((d) => {
          if (d.type !== 'router' && d.ip) {
            if (!ipMap.has(d.ip)) {
              ipMap.set(d.ip, []);
            }
            ipMap.get(d.ip)!.push(d.name);
          }
        });
        const duplicateIPs: string[] = [];
        ipMap.forEach((names, ip) => {
          if (names.length > 1) {
            duplicateIPs.push(`${ip}: ${names.join(', ')}`);
          }
        });
        if (duplicateIPs.length > 0) {
          alert(`❌ IP地址冲突！\n\n以下设备使用了相同的IP地址:\n${duplicateIPs.join('\n')}\n\n请先修改重复的IP地址，再尝试连接设备。`);
          return state;
        }
      }

      let updatedDevices = [...devices];
      let newConnection: Connection;

      if (isRouterDevice(sourceDevice) && isRouterDevice(targetDevice)) {
        const sourceLan = getLanInterface(sourceDevice);
        const targetLan = getLanInterface(targetDevice);
        if (sourceLan && targetLan) {
          const sourceLanSubnet = deriveSubnet(sourceLan.ip, sourceLan.subnetMask || DEFAULT_SUBNET_MASK);
          const targetLanSubnet = deriveSubnet(targetLan.ip, targetLan.subnetMask || DEFAULT_SUBNET_MASK);
          if (sourceLanSubnet === targetLanSubnet) {
            alert(`❌ 路由器 ${sourceDevice.name} 与 ${targetDevice.name} 使用了相同的 LAN 网段 (${sourceLanSubnet})，请先修改其中一台路由器的 LAN 配置。`);
            return state;
          }
        }

        const { subnet, sourceIP, targetIP } = allocateBackboneNetwork(updatedDevices);
        const sourceInterface = createRouterInterface(
          sourceDevice,
          nextEthName(sourceDevice),
          sourceIP,
          subnet
        );
        const targetInterface = createRouterInterface(
          targetDevice,
          nextEthName(targetDevice),
          targetIP,
          subnet
        );

        updatedDevices = updatedDevices.map((device) => {
          if (device.id === sourceDevice.id) {
            return {
              ...device,
              interfaces: [...(device.interfaces || []), sourceInterface]
            };
          }
          if (device.id === targetDevice.id) {
            return {
              ...device,
              interfaces: [...(device.interfaces || []), targetInterface]
            };
          }
          return device;
        });

        newConnection = {
          ...connection,
          sourceInterfaceId: sourceInterface.id,
          targetInterfaceId: targetInterface.id
        };
      } else {
        const router = isRouterDevice(sourceDevice) ? sourceDevice : targetDevice;
        const endpoint = isRouterDevice(sourceDevice) ? targetDevice : sourceDevice;
        const lanInterface = getLanInterface(router);
        if (!lanInterface) {
          alert(`❌ 路由器 ${router.name} 没有 LAN 接口，请先配置路由器。`);
          return state;
        }
        const subnetMask = lanInterface.subnetMask || DEFAULT_SUBNET_MASK;
        if (lanInterface.ip === endpoint.ip) {
          alert(
            `❌ IP地址冲突！\n\n${endpoint.name} 的IP地址与路由器 ${router.name} 的LAN接口 (${lanInterface.ip}) 完全相同。\n\n` +
              `💡 请为 ${endpoint.name} 设置同一网段内的其他可用IP。`
          );
          return state;
        }
        if (!isInSameSubnetHelper(lanInterface.ip, subnetMask, endpoint.ip)) {
          const subnet = lanInterface.subnet || deriveSubnet(lanInterface.ip, subnetMask);
          alert(
            `❌ 子网不匹配！\n\n${endpoint.name} 的IP地址: ${endpoint.ip}\n` +
              `路由器 ${router.name} 的LAN网段: ${subnet}\n子网掩码: ${subnetMask}\n\n` +
              `💡 请修改 ${endpoint.name} 的IP地址，使其在路由器LAN网段内。`
          );
          return state;
        }
        newConnection = { ...connection };
      }

      const newConnections = [...connections, newConnection];
      saveToStorage(updatedDevices, newConnections);

      const updatedSelectedDevice = state.selectedDevice
        ? updatedDevices.find((d) => d.id === state.selectedDevice!.id) || state.selectedDevice
        : null;

      return {
        connections: newConnections,
        devices: updatedDevices,
        selectedDevice: updatedSelectedDevice
      };
    });
  },

  deleteConnection: (id) => {
    set((state) => {
      const connection = state.connections.find((c) => c.id === id);
      if (!connection) return state;

      const { devices } = state;
      let updatedDevices = [...devices];

      if (connection.sourceInterfaceId && connection.targetInterfaceId) {
        updatedDevices = updatedDevices.map((device) => {
          if (device.id === connection.source) {
            return {
              ...device,
              interfaces: device.interfaces?.filter((iface) => iface.id !== connection.sourceInterfaceId)
            };
          }
          if (device.id === connection.target) {
            return {
              ...device,
              interfaces: device.interfaces?.filter((iface) => iface.id !== connection.targetInterfaceId)
            };
          }
          return device;
        });
      } else {
        const sourceDevice = devices.find((d) => d.id === connection.source);
        const targetDevice = devices.find((d) => d.id === connection.target);

        if (sourceDevice && targetDevice && isRouterDevice(sourceDevice) && isRouterDevice(targetDevice)) {
          const getNetwork = (ip: string) => {
            const parts = ip.split('.');
            return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
          };

          let sourceIfaceToRemove: string | null = null;
          let targetIfaceToRemove: string | null = null;

          if (sourceDevice && targetDevice) {
            for (const sourceIface of (sourceDevice.interfaces || [])) {
              if (sourceIface.name === 'LAN') continue;
              const sourceNet = getNetwork(sourceIface.ip);
              for (const targetIface of (targetDevice.interfaces || [])) {
                if (targetIface.name === 'LAN') continue;
                const targetNet = getNetwork(targetIface.ip);
                if (sourceNet === targetNet) {
                  sourceIfaceToRemove = sourceIface.id ?? null;
                  targetIfaceToRemove = targetIface.id ?? null;
                  break;
                }
              }
              if (sourceIfaceToRemove) break;
            }
          }

          if (sourceIfaceToRemove && targetIfaceToRemove) {
            updatedDevices = updatedDevices.map((device) => {
              if (device.id === connection.source) {
                return {
                  ...device,
                  interfaces: device.interfaces?.filter((iface) => iface.id !== sourceIfaceToRemove)
                };
              }
              if (device.id === connection.target) {
                return {
                  ...device,
                  interfaces: device.interfaces?.filter((iface) => iface.id !== targetIfaceToRemove)
                };
              }
              return device;
            });
          }
        }
      }

      const newConnections = state.connections.filter((c) => c.id !== id);
      saveToStorage(updatedDevices, newConnections);
      return {
        ...state,
        connections: newConnections,
        devices: updatedDevices
      };
    });
  },

  simulatePing: (sourceIP, destIP) => {
    const { animationMode, stepToken } = get().gradingTools;
    console.log('[Tracert] simulatePing start', { animationMode, stepToken, sourceIP, destIP });

    set({ isSimulating: true, simulationType: 'ping' });

    const devices = get().devices;
    const connections = get().connections;
    const result = simulateRouting(devices, connections, sourceIP, destIP);

    // 成功且有可视化路径时才需要动画；失败或无路径直接结束
    const shouldAnimate = result.success && result.path.length > 1;
    const delay = applySpeed(400, animationMode);

    setTimeout(() => {
      console.log('[Tracert] simulatePing result ready', { animationMode, stepToken, result, shouldAnimate });
      set({
        simulationResult: result
      });
      get().recordAutoComment('ping', result);

      if (!shouldAnimate) {
        // 没有动画，直接结束
        set({ isSimulating: false });
      }
    }, delay);
  },

  clearSimulation: () => {
    set({ simulationResult: null, simulationType: null });
  },

  stopSimulation: () => {
    set({ isSimulating: false });
  },

  setAnimationCompleteCallback: (callback) => {
    console.log('🔧 setAnimationCompleteCallback 被调用:', callback ? '设置回调' : '清空回调');
    set({ animationCompleteCallback: callback });
  },

  triggerAnimationComplete: () => {
    const callback = get().animationCompleteCallback;
    if (callback) {
      console.log('🎉 触发动画完成回调');
      // ✅ 先清空回调槽位，再执行回调
      // 这样回调内部如果设置新的回调，就不会被清空
      console.log('🧹 清空回调槽位');
      set({ animationCompleteCallback: null });
      callback();
    } else {
      console.warn('⚠️ 没有动画完成回调可执行');
    }
  },

  setHTMLPreviewContent: (content) => {
    set({ htmlPreviewContent: content });
  },

  simulateDNSQuery: (sourceIP, dnsServerIP, domain, onComplete) => {
    const dnsAnimationMode = get().gradingTools.animationMode;
    set({
      isSimulating: true,
      simulationType: 'dns',
      animationCompleteCallback: onComplete || null
    });

    const devices = get().devices;
    const connections = get().connections;

    // 构建DNS查询路径：PC → DNS服务器
    const sourceDevice = devices.find(d => d.ip === sourceIP);
    // ✅ 修复：验证DNS设备类型，防止指向非DNS设备
    const dnsDevice = devices.find(d => d.type === 'dns' && d.ip === dnsServerIP);

    if (!sourceDevice) {
      const failureResult: SimulationResult = {
        success: false,
        path: [],
        message: `❌ DNS查询失败：源设备 ${sourceIP} 不存在`,
        steps: []
      };
      const delay = applySpeed(300, dnsAnimationMode);
      setTimeout(() => {
        set({
          simulationResult: failureResult,
          isSimulating: false
        });
        get().recordAutoComment('dns', failureResult);
        if (onComplete) {
          onComplete();
        }
      }, delay);
      return;
    }

    if (!dnsDevice) {
      // 检查IP是否存在但类型错误
      const wrongTypeDevice = devices.find(d => d.ip === dnsServerIP);
      const message = wrongTypeDevice
        ? `❌ DNS配置错误\n\nIP ${dnsServerIP} 是 ${wrongTypeDevice.name} (${wrongTypeDevice.type === 'web' ? 'Web服务器' : wrongTypeDevice.type === 'pc' ? 'PC' : wrongTypeDevice.type})，不是DNS服务器\n\n💡 请在设备配置中选择正确的DNS服务器`
        : `❌ DNS服务器 ${dnsServerIP} 不存在\n\n💡 请检查DNS服务器IP地址配置`;

      const failureResult: SimulationResult = {
        success: false,
        path: [],
        message: message,
        steps: []
      };
      const delay = applySpeed(300, dnsAnimationMode);
      setTimeout(() => {
        set({
          simulationResult: failureResult,
          isSimulating: false
        });
        get().recordAutoComment('dns', failureResult);
        if (onComplete) {
          onComplete();
        }
      }, delay);
      return;
    }

    // 请求阶段：PC → DNS服务器
    const requestRoute = simulateRouting(devices, connections, sourceIP, dnsServerIP);

    // ✅ 验证路径终点是否真的是DNS设备（防止同IP不同类型的设备）
    if (requestRoute.success && requestRoute.path.length > 0) {
      const pathEndDeviceName = requestRoute.path[requestRoute.path.length - 1];
      if (pathEndDeviceName !== dnsDevice.name) {
        // 路径到达了IP相同但设备不同的设备
        const wrongDevice = devices.find(d => d.name === pathEndDeviceName);
        const failureResult: SimulationResult = {
          success: false,
          path: requestRoute.path,
          message: `❌ DNS查询失败\n\n路由到达了 ${wrongDevice?.name} (${wrongDevice?.type === 'web' ? 'Web服务器' : wrongDevice?.type})，不是DNS服务器 ${dnsDevice.name}\n\n💡 可能原因：\n- DNS和Web服务器使用了相同IP ${dnsServerIP}\n- 请确保DNS服务器使用独立IP地址`,
          steps: requestRoute.steps || []
        };
        const delay = applySpeed(500, dnsAnimationMode);
        setTimeout(() => {
          set({
            simulationResult: failureResult,
            isSimulating: false
          });
          get().recordAutoComment('dns', failureResult);
          if (onComplete) {
            onComplete();
          }
        }, delay);
        return;
      }
    }

    // 响应阶段：DNS服务器 → PC（路径反向）
    const responsePath = requestRoute.success ? [...requestRoute.path].reverse() : [];

    // 查找DNS解析结果
    let resolvedIP = '';
    if (dnsDevice.dnsRecords) {
      const record = dnsDevice.dnsRecords.find(r => r.domain.toLowerCase() === domain.toLowerCase());
      if (record) {
        resolvedIP = record.ip;
      }
    }

    // 立即设置simulationResult，不要延迟
    const dnsSimulationResult: SimulationResult = {
      ...requestRoute,
      isRoundTrip: true,
      requestPath: requestRoute.path,
      responsePath: responsePath,
      requestLabel: `🔍 DNS查询: ${domain}`,
      responseLabel: resolvedIP
        ? `✅ 返回IP: ${resolvedIP}`
        : `❌ 域名不存在`,
      message: requestRoute.success
        ? `✅ DNS查询完成\n${sourceDevice.name} ⇄ ${dnsDevice.name}\n域名: ${domain} → IP: ${resolvedIP || '未找到'}`
        : requestRoute.message
    };

    set({
      simulationResult: dnsSimulationResult
      // ❌ 不要在这里设置 isSimulating: false，应该由动画完成回调来控制
    });
    get().recordAutoComment('dns', dnsSimulationResult);

    // 🔧 修复：如果路由失败且没有路径，立即调用回调（不会有动画）
    if (!requestRoute.success || requestRoute.path.length === 0) {
      console.warn('⚠️ DNS路由失败或无路径，立即触发回调');
      const delay = applySpeed(500, dnsAnimationMode);
      setTimeout(() => {
        set({ isSimulating: false });
        if (onComplete) {
          onComplete();
        }
      }, delay); // 短暂延迟，让错误信息显示出来
    }
  },

  simulateHTTPRequest: (sourceIP, targetIP, httpSuccess, statusCode, onComplete, httpMessage = '') => {
    const httpAnimationMode = get().gradingTools.animationMode;
    console.log('📞 simulateHTTPRequest 被调用，设置回调:', onComplete ? '有回调' : '无回调');
    console.log('🌐 HTTP状态:', httpSuccess ? '成功' : '失败', '状态码:', statusCode);
    set({
      isSimulating: true,
      simulationType: 'http',
      animationCompleteCallback: onComplete || null
    });

    const devices = get().devices;
    const connections = get().connections;

    // ✅ 修复：验证目标设备类型，防止访问非Web设备
    const targetDevice = devices.find(d => d.ip === targetIP);

    if (!targetDevice || targetDevice.type !== 'web') {
      const wrongTypeDevice = devices.find(d => d.ip === targetIP);
      const message = wrongTypeDevice
        ? `❌ HTTP请求失败\n\nIP ${targetIP} 是 ${wrongTypeDevice.name} (${wrongTypeDevice.type === 'dns' ? 'DNS服务器' : wrongTypeDevice.type === 'pc' ? 'PC' : wrongTypeDevice.type})，不是Web服务器\n\n💡 请确认访问的是Web服务器`
        : `❌ HTTP请求失败\n\n目标IP ${targetIP} 不存在\n\n💡 请检查域名DNS解析结果`;

      const failureResult: SimulationResult = {
        success: false,
        path: [],
        message: message,
        steps: [],
        httpSuccess: false,
        httpStatusCode: 503
      };

      const delay = applySpeed(300, httpAnimationMode);
      setTimeout(() => {
        set({
          simulationResult: failureResult,
          isSimulating: false
        });
        get().recordAutoComment('http', failureResult);
        if (onComplete) {
          onComplete();
        }
      }, delay);
      return;
    }

    // 请求阶段：PC → Web服务器
    const requestRoute = simulateRouting(devices, connections, sourceIP, targetIP);

    // ✅ 验证路径终点是否真的是Web设备（防止同IP不同类型的设备）
    if (requestRoute.success && requestRoute.path.length > 0) {
      const pathEndDeviceName = requestRoute.path[requestRoute.path.length - 1];
      if (pathEndDeviceName !== targetDevice.name) {
        // 路径到达了IP相同但设备不同的设备
        const wrongDevice = devices.find(d => d.name === pathEndDeviceName);
        const failureResult: SimulationResult = {
          success: false,
          path: requestRoute.path,
          message: `❌ HTTP请求失败\n\n路由到达了 ${wrongDevice?.name} (${wrongDevice?.type === 'dns' ? 'DNS服务器' : wrongDevice?.type})，不是Web服务器 ${targetDevice.name}\n\n💡 可能原因：\n- DNS和Web服务器使用了相同IP ${targetIP}\n- 请确保Web服务器使用独立IP地址`,
          steps: requestRoute.steps || [],
          httpSuccess: false,
          httpStatusCode: 503
        };
        const delay = applySpeed(500, httpAnimationMode);
        setTimeout(() => {
          set({
            simulationResult: failureResult,
            isSimulating: false
          });
          get().recordAutoComment('http', failureResult);
          if (onComplete) {
            onComplete();
          }
        }, delay);
        return;
      }
    }

    // 响应阶段：Web服务器 → PC（路径反向）
    const responsePath = requestRoute.success ? [...requestRoute.path].reverse() : [];

    const httpSummary = httpSuccess ? `✅ HTTP ${statusCode} 成功` : `❌ HTTP ${statusCode} 失败`;
    const mergedMessage = requestRoute.success
      ? (httpMessage && httpMessage.trim().length > 0 ? `${httpSummary}\n${httpMessage}` : httpSummary)
      : requestRoute.message;

    const httpSimulationResult: SimulationResult = {
      ...requestRoute,
      isRoundTrip: true,
      requestPath: requestRoute.path,
      responsePath: responsePath,
      requestLabel: `📤 HTTP GET /`,
      responseLabel: httpSuccess
        ? `📥 HTTP ${statusCode} OK`
        : `❌ HTTP ${statusCode} 错误`,
      message: mergedMessage,
      httpSuccess,
      httpStatusCode: statusCode
    };

    // 立即设置simulationResult，不要延迟
    set({
      simulationResult: httpSimulationResult
      // ❌ 不要在这里设置 isSimulating: false，应该由动画完成回调来控制
    });
    get().recordAutoComment('http', httpSimulationResult);

    // 调试：检查回调是否还在
    const currentCallback = get().animationCompleteCallback;
    console.log('🔍 设置simulationResult后，回调状态:', currentCallback ? '回调还在' : '回调丢失！');

    // 🔧 修复：如果路由失败且没有路径，立即调用回调（不会有动画）
    if (!requestRoute.success || requestRoute.path.length === 0) {
      console.warn('⚠️ HTTP路由失败或无路径，立即触发回调');
      const delay = applySpeed(500, httpAnimationMode);
      setTimeout(() => {
        set({ isSimulating: false });
        if (onComplete) {
          onComplete();
        }
      }, delay); // 短暂延迟，让错误信息显示出来
    }
  },

  // 清空拓扑
  clearTopology: () => {
    console.log('🗑️ 清空所有设备和连接');
    const emptyDevices: Device[] = [];
    const emptyConnections: Connection[] = [];

    saveToStorage(emptyDevices, emptyConnections);
    set({
      devices: emptyDevices,
      connections: emptyConnections,
      selectedDevice: null,
      simulationResult: null,
      isSimulating: false
    });
  },

  // 导出拓扑为JSON字符串
  exportTopology: () => {
    const { devices, connections, testToolState, browserState } = get();
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      devices,
      connections,
      testToolState, // 包含测试工具状态
      browserState  // 包含浏览器状态
    };
    return JSON.stringify(exportData, null, 2);
  },

  // 从JSON字符串导入拓扑
  importTopology: (jsonData: string) => {
    try {
      const importData = JSON.parse(jsonData);

      // 支持两种格式:
      // 1. 直接格式: { devices: [...], connections: [...], testToolState: {...}, browserState: {...} }
      // 2. 作业提交格式: { studentInfo: {...}, topology: { devices: [...], connections: [...], testToolState: {...}, browserState: {...} } }
      let devices, connections, testToolState, browserState;
      let studentInfo: StudentInfo | null = null;

      if (importData.topology) {
        // 作业提交格式
        devices = importData.topology.devices;
        connections = importData.topology.connections;
        testToolState = importData.topology.testToolState;
        browserState = importData.topology.browserState;
        studentInfo = importData.studentInfo || null;
        console.log(`📥 导入学生作业: ${importData.studentInfo?.name || '未知'} (${importData.studentInfo?.className ? '七年级' + importData.studentInfo.className + '班' : '未知班级'})`);
      } else if (importData.devices && importData.connections) {
        // 直接格式
        devices = importData.devices;
        connections = importData.connections;
        testToolState = importData.testToolState;
        browserState = importData.browserState;
      } else {
        throw new Error('无效的拓扑数据格式');
      }

      console.log(`📥 导入拓扑: ${devices.length}个设备, ${connections.length}个连接`);

      const normalizedDevices = normalizeDevices(devices);
      saveToStorage(normalizedDevices, connections);
      set({
        devices: normalizedDevices,
        connections: connections,
        selectedDevice: null,
        simulationResult: null,
        isSimulating: false,
        currentStudentInfo: studentInfo,
        testToolState: testToolState || { sourceIP: '', destIP: '' }, // 恢复测试工具状态
        browserState: browserState || { sourceIP: '', url: '', port: 80, dnsServerIP: '' } // 恢复浏览器状态
      });
    } catch (error) {
      console.error('❌ 导入拓扑失败:', error);
      throw error;
    }
  },

  // 自动适配视图：只调整缩放，不修改设备位置和连线
  autoLayout: (canvasWidth: number, canvasHeight: number) => {
    const { devices } = get();

    if (devices.length === 0) {
      return { scale: 1, translateX: 0, translateY: 0 };
    }

    console.log('📐 画布实际尺寸:', { canvasWidth, canvasHeight });

    // 设备节点的大小（考虑设备图标的实际尺寸）
    const deviceSize = 60; // 设备图标大约60px

    // 计算所有设备的边界框（最边缘的位置）
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    devices.forEach(device => {
      // 考虑设备图标的实际尺寸，计算边界
      minX = Math.min(minX, device.position.x - deviceSize / 2);
      maxX = Math.max(maxX, device.position.x + deviceSize / 2);
      minY = Math.min(minY, device.position.y - deviceSize / 2);
      maxY = Math.max(maxY, device.position.y + deviceSize / 2);
    });

    // 计算边界框的中心和大小
    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 添加边距（比设备边缘稍大一点，留出15%的边距更舒适）
    const paddingRatio = 0.15;
    const paddingX = boundingWidth * paddingRatio;
    const paddingY = boundingHeight * paddingRatio;

    // 目标区域（包含边距）
    const targetWidth = boundingWidth + paddingX * 2;
    const targetHeight = boundingHeight + paddingY * 2;

    // 计算合适的缩放比例，让所有设备正好显示在画布中
    const scaleX = canvasWidth / targetWidth;
    const scaleY = canvasHeight / targetHeight;
    const scale = Math.min(scaleX, scaleY, 1.5); // 最大不超过1.5倍，避免缩放过大

    // 计算平移量，使内容居中
    const translateX = (canvasWidth / 2) - (centerX * scale);
    const translateY = (canvasHeight / 2) - (centerY * scale);

    console.log('📐 自动适配视图完成:', {
      deviceCount: devices.length,
      boundingBox: `${boundingWidth.toFixed(0)}x${boundingHeight.toFixed(0)}`,
      scale: scale.toFixed(2),
      targetSize: `${targetWidth.toFixed(0)}x${targetHeight.toFixed(0)}`,
      center: `(${centerX.toFixed(0)}, ${centerY.toFixed(0)})`
    });

    return { scale, translateX, translateY };
  }
}});

// 辅助函数：获取IP的网段
function getNetwork(ip: string): string {
  const parts = ip.split('.');
  return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
}

// 辅助函数：检查两个设备之间是否有物理连接
function hasPhysicalConnection(
  deviceA: Device,
  deviceB: Device,
  connections: Connection[]
): boolean {
  return connections.some(
    (c) =>
      (c.source === deviceA.id && c.target === deviceB.id) ||
      (c.source === deviceB.id && c.target === deviceA.id)
  );
}

// 辅助函数：验证IP地址格式
function validateIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    const num = parseInt(part);
    return !isNaN(num) && num >= 0 && num <= 255;
  });
}

// 路由查找模拟函数 - 完全重写，严格检查
function simulateRouting(
  devices: Device[],
  connections: Connection[],
  sourceIP: string,
  destIP: string,
  showSteps = false
): SimulationResult {
  const path: string[] = [];
  const steps: Array<{ router: string; action: string; routeEntry?: any }> = [];

  // 1. 验证IP地址格式
  if (!validateIP(sourceIP)) {
    return {
      success: false,
      path: [],
      message: `❌ 源IP地址格式错误: ${sourceIP}`,
      steps: []
    };
  }

  if (!validateIP(destIP)) {
    return {
      success: false,
      path: [],
      message: `❌ 目标IP地址格式错误: ${destIP}`,
      steps: []
    };
  }

  // 2. 找到源设备
  const sourceDevice = devices.find((d) => d.ip === sourceIP);
  if (!sourceDevice) {
    return {
      success: false,
      path: [],
      message: `❌ 找不到源IP ${sourceIP} 对应的设备`,
      steps: []
    };
  }

  path.push(sourceDevice.name);

  // 3. 检查是否源和目标是同一设备
  if (sourceIP === destIP) {
    return {
      success: true,
      path,
      message: `✅ 源和目标是同一设备`,
      steps: []
    };
  }

  let currentDevice = sourceDevice;
  let hopCount = 0;
  const maxHops = 10;
  const visitedDevices = new Set<string>([sourceDevice.id]); // 防止环路

  while (hopCount < maxHops) {
    // 4. 检查是否到达目的地
    if (currentDevice.ip === destIP) {
      return {
        success: true,
        path,
        message: `✅ 成功到达目的地！经过了 ${hopCount} 跳`,
        steps
      };
    }

    let nextDevice: Device | null = null;

    // 5. 终端设备（PC/DNS/Web等）处理：找默认网关
    if (currentDevice.type !== 'router') {
      const currentNetwork = getNetwork(currentDevice.ip);
      const endpointLabel =
        currentDevice.type === 'pc'
          ? `PC ${currentDevice.name}`
          : `${currentDevice.type.toUpperCase()} ${currentDevice.name}`;

      // 查找同网段的路由器
      const gateway = devices.find(
        (d) =>
          d.type === 'router' &&
          d.interfaces &&
          d.interfaces.some((iface) => getNetwork(iface.ip) === currentNetwork)
      );

      if (!gateway) {
        return {
          success: false,
          path,
          message: `❌ ${endpointLabel} (${currentDevice.ip}) 找不到默认网关\n网段: ${currentNetwork}`,
          steps
        };
      }

      // 检查物理连接
      if (!hasPhysicalConnection(currentDevice, gateway, connections)) {
        return {
          success: false,
          path,
          message: `❌ ${endpointLabel} 和网关 ${gateway.name} 之间没有物理连接线！\n请先用 Shift+点击 连接这两个设备。`,
          steps
        };
      }

      if (showSteps) {
        steps.push({
          router: currentDevice.name,
          action: `${endpointLabel} 发送数据到默认网关 ${gateway.name}`
        });
      }

      nextDevice = gateway;
    }
    // 6. 路由器的处理：查路由表
    else if (currentDevice.type === 'router') {
      // 检查路由表是否存在
      if (!currentDevice.routingTable || currentDevice.routingTable.length === 0) {
        return {
          success: false,
          path,
          message: `❌ 路由器 ${currentDevice.name} 的路由表为空！\n请配置路由表。`,
          steps
        };
      }

      const destNetwork = getNetwork(destIP);

      // 查找所有匹配的路由，支持两种格式：
      // 1. 精确IP匹配（如 192.168.1.100）- 优先级最高
      // 2. 网络地址匹配（如 192.168.1.0）- 兜底匹配
      let matchingRoutes = currentDevice.routingTable.filter((r) => r.destination === destIP);

      // 如果没有精确IP匹配，再尝试网络地址匹配
      if (matchingRoutes.length === 0) {
        matchingRoutes = currentDevice.routingTable.filter((r) => r.destination === destNetwork);
      }

      if (matchingRoutes.length === 0) {
        return {
          success: false,
          path,
          message: `❌ 路由器 ${currentDevice.name} 的路由表中没有到达 ${destIP} (${destNetwork}) 的路由！\n当前路由表只有: ${currentDevice.routingTable.map((r) => r.destination).join(', ')}`,
          steps
        };
      }

      // 按权重排序所有匹配的路由（从最优到次优）
      const sortedRoutes = matchingRoutes.sort((a, b) => a.metric - b.metric);

      // 尝试每条路由，直到找到物理连接正常的
      let route: RouteEntry | null = null;
      let failedRoutes: Array<{nextHop: string, metric: number, reason: string}> = [];

      for (const candidateRoute of sortedRoutes) {
        // 处理直连网络（支持多种表示方式）
        if (candidateRoute.nextHop === '-' || candidateRoute.nextHop === '直连' || candidateRoute.nextHop === '0.0.0.0') {
          const destDevice = devices.find((d) => d.ip === destIP);

          if (!destDevice) {
            failedRoutes.push({
              nextHop: '直连',
              metric: candidateRoute.metric,
              reason: `目标IP ${destIP} 不存在`
            });
            continue; // 尝试下一条路由
          }

          // 检查路由器是否有该网段的接口
          const hasInterface = currentDevice.interfaces?.some(
            (iface) => getNetwork(iface.ip) === destNetwork
          );

          if (!hasInterface) {
            failedRoutes.push({
              nextHop: '直连',
              metric: candidateRoute.metric,
              reason: '路由器没有该网段的接口'
            });
            continue; // 尝试下一条路由
          }

          // 检查物理连接
          if (!hasPhysicalConnection(currentDevice, destDevice, connections)) {
            failedRoutes.push({
              nextHop: '直连',
              metric: candidateRoute.metric,
              reason: '物理连接断开'
            });
            continue; // 尝试下一条路由
          }

          // 找到可用的直连路由
          route = candidateRoute;
          break;
        }
        // 转发到下一站路由器
        else {
          // 先按名称查找，找不到再按IP地址查找
          let nextRouter = devices.find((d) => d.name === candidateRoute.nextHop);

          if (!nextRouter) {
            // 尝试按IP地址查找（查找拥有该IP接口的路由器）
            nextRouter = devices.find((d) =>
              d.type === 'router' &&
              d.interfaces?.some((iface) => iface.ip === candidateRoute.nextHop)
            );
          }

          if (!nextRouter) {
            failedRoutes.push({
              nextHop: candidateRoute.nextHop,
              metric: candidateRoute.metric,
              reason: '下一站路由器不存在'
            });
            continue; // 尝试下一条路由
          }

          if (nextRouter.type !== 'router') {
            failedRoutes.push({
              nextHop: candidateRoute.nextHop,
              metric: candidateRoute.metric,
              reason: `不是路由器(${nextRouter.type})`
            });
            continue; // 尝试下一条路由
          }

          // 检查物理连接
          if (!hasPhysicalConnection(currentDevice, nextRouter, connections)) {
            failedRoutes.push({
              nextHop: candidateRoute.nextHop,
              metric: candidateRoute.metric,
              reason: '物理连接断开'
            });
            continue; // 尝试下一条路由
          }

          // 检查接口配置（两个路由器的接口IP应该在同一网段）
          const currentRouterInterfaces = currentDevice.interfaces || [];
          const nextRouterInterfaces = nextRouter.interfaces || [];

          let hasCommonNetwork = false;
          for (const currentIface of currentRouterInterfaces) {
            const currentNet = getNetwork(currentIface.ip);
            for (const nextIface of nextRouterInterfaces) {
              const nextNet = getNetwork(nextIface.ip);
              if (currentNet === nextNet) {
                hasCommonNetwork = true;
                break;
              }
            }
            if (hasCommonNetwork) break;
          }

          if (!hasCommonNetwork) {
            failedRoutes.push({
              nextHop: candidateRoute.nextHop,
              metric: candidateRoute.metric,
              reason: '接口配置错误(没有共同网段)'
            });
            continue; // 尝试下一条路由
          }

          // 找到可用的转发路由
          route = candidateRoute;
          break;
        }
      }

      // 循环结束后，检查是否找到了可用路由
      if (!route) {
        const failedInfo = failedRoutes
          .map(f => `${f.nextHop}(权重${f.metric}, ${f.reason})`)
          .join(', ');

        return {
          success: false,
          path,
          message: `❌ 路由器 ${currentDevice.name} 的所有路由都不可用！\n目标: ${destIP}\n尝试过的路由: ${failedInfo}\n\n请检查物理连接或路由配置。`,
          steps
        };
      }

      // 如果使用了备用路由，添加提示信息
      const routeIndex = sortedRoutes.indexOf(route);
      if (routeIndex > 0 && showSteps) {
        const skippedRoutes = failedRoutes.slice(0, routeIndex)
          .map(f => `${f.nextHop}(权重${f.metric})`)
          .join(', ');

        steps.push({
          router: currentDevice.name,
          action: `⚠️ 最优路由不可用 [${skippedRoutes}]，使用备用路由: ${route.nextHop}(权重${route.metric})`,
          routeEntry: route
        });
      }

      // 正常路由选择提示
      if (showSteps && routeIndex === 0) {
        steps.push({
          router: currentDevice.name,
          action: `查找路由表: 目标网段 ${destNetwork}, 下一站 ${route.nextHop}, 权重 ${route.metric}`,
          routeEntry: route
        });
      }

      // 根据选定的路由设置nextDevice
      if (route.nextHop === '-' || route.nextHop === '直连' || route.nextHop === '0.0.0.0') {
        // 直连网络 - 返回成功
        const destDevice = devices.find((d) => d.ip === destIP);
        path.push(destDevice!.name);
        return {
          success: true,
          path,
          message: `✅ 成功到达目的地！经过了 ${hopCount} 跳`,
          steps
        };
      } else {
        // 转发到下一站路由器
        let nextRouter = devices.find((d) => d.name === route.nextHop);
        if (!nextRouter) {
          nextRouter = devices.find((d) =>
            d.type === 'router' &&
            d.interfaces?.some((iface) => iface.ip === route.nextHop)
          );
        }
        nextDevice = nextRouter!;
      }
    }

    if (!nextDevice) {
      return {
        success: false,
        path,
        message: `❌ 在 ${currentDevice.name} 无法继续转发`,
        steps
      };
    }

    // 检查环路
    if (visitedDevices.has(nextDevice.id)) {
      return {
        success: false,
        path,
        message: `❌ 检测到路由环路！设备 ${nextDevice.name} 已经访问过。\n路径: ${path.join(' → ')}`,
        steps
      };
    }

    path.push(nextDevice.name);
    visitedDevices.add(nextDevice.id);
    currentDevice = nextDevice;
    hopCount++;
  }

  return {
    success: false,
    path,
    message: `❌ 超过最大跳数限制 (${maxHops}跳)，可能存在路由环路`,
    steps
  };
}

function formatAutoComment(
  type: 'ping' | 'dns' | 'http',
  result: SimulationResult
): string {
  const labelMap: Record<'ping' | 'dns' | 'http', string> = {
    ping: 'Ping测试',
    dns: 'DNS解析',
    http: 'HTTP访问'
  };

  const icon = result.success ? '✅' : '❌';
  const lines: string[] = [`${icon} ${labelMap[type]}：${result.message}`];

  if (!result.success && result.steps && result.steps.length > 0) {
    lines.push(`排查提示：${result.steps[0].action}`);
  }

  if (type === 'ping') {
    if (result.path && result.path.length > 0) {
      lines.push(`路径：${result.path.join(' → ')}`);
    }
  }

  if (type === 'dns') {
    if (result.responseLabel) {
      lines.push(`DNS结果：${result.responseLabel}`);
    }
  }

  if (type === 'http') {
    if (typeof result.httpStatusCode === 'number') {
      lines.push(`HTTP状态：${result.httpStatusCode}${result.httpSuccess ? ' (成功)' : ' (失败)'}`);
    }
    if (result.requestPath && result.requestPath.length > 0) {
      lines.push(`路径：${result.requestPath.join(' → ')}`);
    }
  }

  return lines.join('\n');
}

function applySpeed(base: number, mode: 'step' | 'normal' | 'fast'): number {
  if (mode === 'fast') return Math.max(50, Math.round(base * 0.25));
  return base;
}