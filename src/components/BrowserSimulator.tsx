import React, { useState, useEffect } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { HTTPHandler } from '../utils/httpHandler';
import { DNSQueryResult, HTTPResponse } from '../types';

export const BrowserSimulator: React.FC = () => {
  const {
    devices,
    simulateDNSQuery,
    simulateHTTPRequest,
    clearSimulation,
    stopSimulation,
    setHTMLPreviewContent,
    browserState,
    setBrowserState,
    gradingTools,
    simulationType
  } = useNetworkStore();

  // 使用store中的状态
  const sourceIP = browserState.sourceIP;
  const url = browserState.url;
  const port = browserState.port;
  const dnsServerIP = browserState.dnsServerIP;
  const urlType = browserState.urlType;

  // 本地UI状态（不需要持久化）
  const [dnsResult, setDnsResult] = useState<DNSQueryResult | null>(null);
  const [httpResponse, setHttpResponse] = useState<HTTPResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSteps, setShowSteps] = useState(true);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'dns' | 'http'>('idle');

  const pcDevices = devices.filter((d) => d.type === 'pc');
  const dnsServers = devices.filter((d) => d.type === 'dns');

  // 当选择PC时，自动加载其配置的DNS服务器
  const handlePCChange = (newSourceIP: string) => {
    const selectedPC = devices.find((d) => d.ip === newSourceIP && d.type === 'pc');
    if (selectedPC) {
      // 加载PC配置的DNS服务器，如果没有配置则设为空字符串
      setBrowserState({ ...browserState, sourceIP: newSourceIP, dnsServerIP: selectedPC.dnsServer || '' });
    } else {
      // 如果没有选择PC，清空DNS
      setBrowserState({ ...browserState, sourceIP: newSourceIP, dnsServerIP: '' });
    }
  };

  // 监听设备变化，当PC的DNS配置改变时自动更新
  useEffect(() => {
    if (sourceIP) {
      const selectedPC = devices.find((d) => d.ip === sourceIP && d.type === 'pc');
      if (selectedPC && selectedPC.dnsServer !== dnsServerIP) {
        setBrowserState({ ...browserState, dnsServerIP: selectedPC.dnsServer || '' });
      }
    }
  }, [devices, sourceIP]);

  // 监听simulationType，当Ping测试开始时清空浏览器的结果（实现工具互不干扰）
  useEffect(() => {
    if (simulationType === 'ping') {
      // Ping测试开始了，清空浏览器的本地状态
      setDnsResult(null);
      setHttpResponse(null);
      setIsLoading(false);
      setAnimationPhase('idle');
    }
  }, [simulationType]);

  const handleVisit = () => {
    setIsLoading(true);
    setDnsResult(null);
    setHttpResponse(null);
    clearSimulation(); // 清除之前的动画（包括Ping测试的结果）

    // 解析URL提取域名或IP（不处理端口，端口由单独的输入框控制）
    let parsedInput = url;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        parsedInput = urlObj.hostname;
      }
    } catch (error) {
      setHttpResponse({
        success: false,
        statusCode: 400,
        message: `❌ URL格式错误：${error instanceof Error ? error.message : '未知错误'}`,
      });
      setIsLoading(false);
      return;
    }

    // 判断输入是IP地址还是域名
    const isIPAddress = HTTPHandler.checkIsIPAddress(parsedInput);

    // 根据用户选择的类型校验格式
    if (urlType === 'domain') {
      // 用户选择了域名,但输入的是IP
      if (isIPAddress) {
        setHttpResponse({
          success: false,
          statusCode: 400,
          message: `❌ 域名格式不合法`,
        });
        setIsLoading(false);
        return;
      }
      // 校验域名格式：不允许连续点号、不允许以点号开头/结尾
      if (/\.\./.test(parsedInput) || parsedInput.startsWith('.') || parsedInput.endsWith('.')) {
        setHttpResponse({
          success: false,
          statusCode: 400,
          message: `❌ 域名格式不合法`,
        });
        setIsLoading(false);
        return;
      }
    } else if (urlType === 'ip') {
      // 用户选择了IP,但输入的不是合法IP
      if (!isIPAddress) {
        setHttpResponse({
          success: false,
          statusCode: 400,
          message: `❌ IP地址格式不合法`,
        });
        setIsLoading(false);
        return;
      }
    }

    console.log(`🌐 解析URL: ${url} → ${isIPAddress ? 'IP地址' : '域名'}: ${parsedInput}, 目标端口: ${port}`);

    const httpHandler = new HTTPHandler(devices);

    // 如果是IP地址，直接发起HTTP请求（跳过DNS）
    if (isIPAddress) {
      console.log('📍 检测到IP地址，跳过DNS查询，直接发起HTTP请求');

      const httpResponse = httpHandler.handleDirectIPRequest({
        method: 'GET',
        url: url,
        domain: '', // IP访问不需要域名
        sourceIP: sourceIP,
        targetIP: parsedInput, // 直接使用IP
        port: port,
      });

      // 直接进入HTTP请求阶段
      setAnimationPhase('http');
      console.log('🚀 开始 HTTP 请求动画（IP直接访问）');

      simulateHTTPRequest(
        sourceIP,
        parsedInput, // 目标IP
        httpResponse.success,
        httpResponse.statusCode,
        () => {
          // HTTP 动画完成的回调
          console.log('✅ HTTP 动画完成，显示最终结果');
          setHttpResponse(httpResponse);
          setIsLoading(false);
          setAnimationPhase('idle');
          stopSimulation();

          // 如果HTTP请求成功且有内容，弹出渲染窗口
          if (httpResponse.success && httpResponse.content) {
            console.log('🎉 HTTP响应成功，准备弹出HTML预览窗口');
            setHTMLPreviewContent({
              content: httpResponse.content,
              url: parsedInput,
              port: port
            });
          }
        },
        httpResponse.message
      );
      return;
    }

    // 如果是域名，检查是否配置了DNS服务器
    if (!dnsServerIP) {
      setHttpResponse({
        success: false,
        statusCode: 0,
        message: `❌ DNS配置错误：该PC未配置DNS服务器\n\n💡 解决方法：\n1. 双击PC设备图标\n2. 在编辑界面选择DNS服务器\n3. 点击保存后重试`,
      });
      setIsLoading(false);
      return;
    }

    // 域名访问：预先获取HTTP结果（用于后续显示）
    const httpResult = httpHandler.handleRequest(
      {
        method: 'GET',
        url: url,
        domain: parsedInput,
        sourceIP: sourceIP,
        targetIP: '', // 会通过DNS解析
        port: port,
      },
      dnsServerIP
    );

    // 第一阶段：DNS查询动画（带回调）
    setAnimationPhase('dns');
    console.log('🚀 开始 DNS 查询动画（域名访问）');

    simulateDNSQuery(sourceIP, dnsServerIP, parsedInput, () => {
      // DNS 动画完成的回调
      console.log('✅ DNS 动画完成，显示DNS结果');
      const latestSimulationResult = useNetworkStore.getState().simulationResult;
      const routingFailed = latestSimulationResult ? !latestSimulationResult.success : false;

      if (routingFailed) {
        const failureMessage =
          latestSimulationResult?.message ||
          `❌ DNS查询失败：无法到达DNS服务器 ${dnsServerIP}`;
        const failureSteps =
          latestSimulationResult?.steps && latestSimulationResult.steps.length > 0
            ? latestSimulationResult.steps.map((step) => ({
                action: step.router || '路由检查',
                details: step.action,
              }))
            : [
                {
                  action: '路由检查',
                  details: failureMessage,
                },
              ];

        setDnsResult({
          success: false,
          domain: parsedInput,
          message: failureMessage,
          steps: failureSteps,
        });

        setHttpResponse({
          success: false,
          statusCode: 0,
          message: `${failureMessage}\n\nHTTP 请求已终止：DNS 查询未成功抵达 DNS 服务器。`,
        });

        setIsLoading(false);
        setAnimationPhase('idle');
        stopSimulation();
        return;
      }

      setDnsResult(httpResult.dnsResult || null);

      // 第二阶段：HTTP请求动画（如果DNS解析成功）
      const dnsQueryOutcome = httpResult.dnsResult;
      const resolvedIP = dnsQueryOutcome?.resolvedIP;
      if (dnsQueryOutcome?.success && resolvedIP) {
        // 添加短暂延迟，让动画过渡更自然
        const mode = gradingTools.animationMode || (gradingTools.fastMode ? 'fast' : 'normal');
        const transitionDelay =
          mode === 'fast' ? Math.max(60, Math.floor(150 * 0.5)) :
          mode === 'step' ? 200 :
          150;
        setTimeout(() => {
          setAnimationPhase('http');
          console.log('🚀 开始 HTTP 请求动画');

          simulateHTTPRequest(
            sourceIP,
            resolvedIP,
            httpResult.response.success,
            httpResult.response.statusCode,
            () => {
              // HTTP 动画完成的回调
              console.log('✅ HTTP 动画完成，显示最终结果');
              const latestHTTPSimulation = useNetworkStore.getState().simulationResult;
              const httpRoutingFailed = latestHTTPSimulation ? !latestHTTPSimulation.success : false;

              if (httpRoutingFailed) {
                const httpFailureMessage =
                  latestHTTPSimulation?.message ||
                  `❌ HTTP请求失败：无法到达Web服务器 ${resolvedIP}`;

                setHttpResponse({
                  success: false,
                  statusCode: 0,
                  message: `${httpFailureMessage}\n\nHTTP 请求已终止：请检查路由表或物理连接。`,
                });

                setIsLoading(false);
                setAnimationPhase('idle');
                stopSimulation();
                return;
              }

              setHttpResponse(httpResult.response);
              setIsLoading(false);
              setAnimationPhase('idle');
              stopSimulation(); // 停止模拟状态

              // 如果HTTP请求成功且有内容，弹出渲染窗口
              if (httpResult.response.success && httpResult.response.content) {
                console.log('🎉 HTTP响应成功，准备弹出HTML预览窗口');
                setHTMLPreviewContent({
                  content: httpResult.response.content,
                  url: parsedInput,
                  port: port
                });
              }
            },
            httpResult.response.message
          );
        }, transitionDelay); // 加快过渡速度
      } else {
        // DNS解析失败，直接显示结果
        setHttpResponse(httpResult.response);
        setIsLoading(false);
        setAnimationPhase('idle');
        stopSimulation(); // 停止模拟状态
      }
    });
  };

  const renderDNSSteps = () => {
    if (!dnsResult || !showSteps) return null;

    return (
      <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-bold text-blue-800 mb-2">
          🔍 DNS解析过程
        </h4>
        <div className="space-y-2">
          {dnsResult.steps.map((step, index) => (
            <div key={index} className="text-xs">
              <span className="font-bold">{step.action}:</span>
              <span className="font-mono ml-2">{step.details}</span>
            </div>
          ))}
        </div>
        {dnsResult.success && dnsResult.resolvedIP && (
          <div className="mt-2 pt-2 border-t border-blue-300">
            <span className="text-sm font-bold text-green-700">
              ✅ 解析成功: {dnsResult.domain} → {dnsResult.resolvedIP}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderHTTPResponse = () => {
    if (!httpResponse) return null;

    // 根据状态码确定颜色
    const getStatusColor = (code: number) => {
      if (code >= 200 && code < 300) return 'text-green-600 bg-green-100';
      if (code >= 400 && code < 500) return 'text-yellow-600 bg-yellow-100';
      if (code >= 500) return 'text-red-600 bg-red-100';
      return 'text-gray-600 bg-gray-100';
    };

    return (
      <div className={`p-4 rounded-lg border-2 ${httpResponse.success ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
        {/* 大号状态标识 */}
        <div className="flex items-center gap-3 mb-3">
          <div className={`text-4xl ${httpResponse.success ? 'text-green-500' : 'text-red-500'}`}>
            {httpResponse.success ? '✅' : '❌'}
          </div>
          <div>
            <h4 className={`text-lg font-bold ${httpResponse.success ? 'text-green-700' : 'text-red-700'}`}>
              {httpResponse.success ? 'HTTP 请求成功' : 'HTTP 请求失败'}
            </h4>
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mt-1 ${getStatusColor(httpResponse.statusCode)}`}>
              状态码: {httpResponse.statusCode}
            </div>
          </div>
        </div>

        <div className="text-sm space-y-2">
          <div className={`p-2 rounded ${httpResponse.success ? 'bg-white' : 'bg-red-100'}`}>
            <span className="font-bold">响应消息:</span>
            <div className="mt-1 whitespace-pre-wrap">{httpResponse.message}</div>
          </div>
          {httpResponse.content && (
            <div className="mt-2">
              <span className="font-bold">页面内容:</span>
              <div className="mt-1 p-3 bg-white rounded border overflow-auto max-h-40">
                <pre className="text-xs whitespace-pre-wrap">{httpResponse.content}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4 text-gray-800">🌐 浏览器模拟器</h3>

      {/* 配置区 */}
      <div className="grid grid-cols-1 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            源PC IP:
          </label>
          <select
            value={sourceIP}
            onChange={(e) => handlePCChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled={isLoading}
          >
            <option value="">选择PC</option>
            {pcDevices.map((pc) => (
              <option key={pc.id} value={pc.ip}>
                {pc.name} ({pc.ip})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            DNS服务器 IP:
          </label>
          <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
            {dnsServerIP ? (
              <span className="font-mono text-gray-900">
                {dnsServers.find(d => d.ip === dnsServerIP)?.name || 'DNS'} ({dnsServerIP})
              </span>
            ) : (
              <span className="text-gray-500">
                ⚠️ 未配置DNS（域名访问需要，IP访问可选）
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            💡 访问域名（如 www.example.com）需要DNS服务器，直接访问IP地址不需要
          </p>
        </div>

        <div>
          <div className="flex items-center gap-4 mb-2">
            <label className="block text-sm font-medium text-gray-700">
              访问URL:
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  value="domain"
                  checked={urlType === 'domain'}
                  onChange={(e) => setBrowserState({ ...browserState, urlType: e.target.value as 'domain' | 'ip' })}
                  disabled={isLoading}
                  className="cursor-pointer"
                />
                <span className="text-sm text-gray-700">域名</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  value="ip"
                  checked={urlType === 'ip'}
                  onChange={(e) => setBrowserState({ ...browserState, urlType: e.target.value as 'domain' | 'ip' })}
                  disabled={isLoading}
                  className="cursor-pointer"
                />
                <span className="text-sm text-gray-700">IP地址</span>
              </label>
            </div>
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setBrowserState({ ...browserState, url: e.target.value })}
            placeholder={urlType === 'domain' ? 'www.example.com' : '10.2.0.10'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 {urlType === 'domain' ? '域名访问需要DNS服务器' : 'IP访问将跳过DNS解析'}，端口由下方单独设置
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            目标端口:
          </label>
          <input
            type="number"
            value={port}
            onChange={(e) => setBrowserState({ ...browserState, port: parseInt(e.target.value) || 80 })}
            placeholder="80"
            min="1"
            max="65535"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 默认: 80 (HTTP), 443 (HTTPS)。需要与Web服务器监听端口一致
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleVisit}
            disabled={
              !sourceIP ||
              !url ||
              isLoading ||
              // 只有域名访问才需要DNS，IP直接访问不需要
              (!HTTPHandler.checkIsIPAddress(url.replace(/^https?:\/\//, '').split(/[:/]/)[0]) && !dnsServerIP)
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? '访问中...' : '🌐 访问'}
          </button>

          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={showSteps}
              onChange={(e) => setShowSteps(e.target.checked)}
              className="mr-2"
            />
            显示详细步骤
          </label>

          {animationPhase !== 'idle' && (
            <span className="text-sm font-bold text-blue-600">
              {animationPhase === 'dns' ? '🔍 DNS查询中...' : '📤 HTTP请求中...'}
            </span>
          )}
        </div>
      </div>

      {/* 结果显示区 */}
      {(dnsResult || httpResponse) && (
        <div className="space-y-4">
          {renderDNSSteps()}
          {renderHTTPResponse()}
        </div>
      )}
    </div>
  );
};
