import React from 'react';
import { useNetworkStore } from '../store/useNetworkStore';

export const HTMLPreviewModal: React.FC = () => {
  const { htmlPreviewContent, setHTMLPreviewContent } = useNetworkStore();

  // 如果没有内容，不渲染模态框
  if (!htmlPreviewContent) {
    return null;
  }

  const handleClose = () => {
    setHTMLPreviewContent(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-11/12 h-5/6 flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌐</span>
            <h2 className="text-xl font-bold text-white">网页加载完成</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:text-gray-200 transition-colors text-3xl font-bold leading-none"
            title="关闭"
          >
            ×
          </button>
        </div>

        {/* 浏览器地址栏模拟 */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-2">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="flex-1 px-4 py-2 bg-white rounded-full border border-gray-300 text-sm text-gray-600 font-mono">
            http://{htmlPreviewContent.url}:{htmlPreviewContent.port}/
          </div>
          <button className="text-gray-500 hover:text-gray-700">
            🔄
          </button>
        </div>

        {/* 网页内容区 */}
        <div className="flex-1 overflow-auto p-2 bg-gray-100">
          <div className="h-full bg-white rounded shadow-inner">
            <iframe
              srcDoc={htmlPreviewContent.content}
              title="网页预览"
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>

        {/* 底部工具栏 */}
        <div className="px-6 py-3 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            ✅ 页面已成功加载
          </div>
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            关闭浏览器
          </button>
        </div>
      </div>
    </div>
  );
};
