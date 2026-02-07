import React, { useState } from 'react';
import { Device } from '../types';
import { useNetworkStore } from '../store/useNetworkStore';

interface WebServerManagerProps {
  device: Device;
}

export const WebServerManager: React.FC<WebServerManagerProps> = ({ device }) => {
  const { updateDevice, devices } = useNetworkStore();

  // 实时从store获取最新的设备数据
  const currentDevice = devices.find(d => d.id === device.id) || device;

  const [content, setContent] = useState(currentDevice.webContent || '');
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = () => {
    updateDevice(device.id, {
      webContent: content,
    });
    setIsEditing(false);
  };

  const handleLoadTemplate = (template: string) => {
    const templates: { [key: string]: string } = {
      welcome: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>欢迎页面</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        h1 { font-size: 48px; margin-bottom: 20px; }
        p { font-size: 20px; }
    </style>
</head>
<body>
    <h1>🎉 欢迎访问我的网站</h1>
    <p>这是七年级信息科技课程的网络实验平台</p>
    <p>服务器IP: ${device.ip}</p>
</body>
</html>`,
      school: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>学校官网</title>
    <style>
        body {
            margin: 0;
            font-family: "Microsoft YaHei", sans-serif;
        }
        .header {
            background: #2c3e50;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .content {
            max-width: 800px;
            margin: 30px auto;
            padding: 20px;
        }
        .card {
            border: 1px solid #ddd;
            padding: 20px;
            margin: 10px 0;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏫 学校官方网站</h1>
        <p>欢迎来到我们的数字校园</p>
    </div>
    <div class="content">
        <div class="card">
            <h2>📚 教育理念</h2>
            <p>培养德智体美劳全面发展的社会主义建设者和接班人</p>
        </div>
        <div class="card">
            <h2>💻 信息科技课程</h2>
            <p>本网站由七年级学生在信息科技课程中搭建</p>
        </div>
    </div>
</body>
</html>`,
      simple: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>简单页面</title>
</head>
<body>
    <h1>Hello World!</h1>
    <p>这是一个简单的网页</p>
    <p>服务器: ${device.name}</p>
    <p>IP地址: ${device.ip}</p>
</body>
</html>`,
    };

    setContent(templates[template] || '');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">
          🌐 Web服务器配置 - {device.name}
        </h3>
        <span className="text-sm text-gray-500">IP: {device.ip}</span>
      </div>

      {/* 配置说明 */}
      <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
        <p className="text-blue-800">
          <strong>💡 配置说明：</strong>
        </p>
        <p className="text-blue-700 mt-1">
          • Web服务器通过 <strong>IP地址 ({device.ip})</strong> 和 <strong>端口号 ({currentDevice.port || 80})</strong> 提供服务
        </p>
        <p className="text-blue-700 mt-1">
          • IP地址和端口号请在<strong>双击设备图标</strong>的编辑框中配置
        </p>
        <p className="text-blue-700 mt-1">
          • 域名配置请在 <strong>DNS管理器</strong> 中添加域名解析记录
        </p>
      </div>

      {/* 网页内容编辑 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            网页HTML内容
          </label>
          <div className="flex items-center gap-2">
            {content && !isEditing && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-sm text-green-600 hover:text-green-800 font-bold"
              >
                {showPreview ? '📝 显示代码' : '👁️ 预览效果'}
              </button>
            )}
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-blue-600 hover:text-blue-800 font-bold"
              >
                ✏️ 编辑
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="请输入HTML代码..."
              rows={12}
              className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {/* 模板选择 */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-600">快速模板：</span>
              <button
                onClick={() => handleLoadTemplate('welcome')}
                className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                欢迎页面
              </button>
              <button
                onClick={() => handleLoadTemplate('school')}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                学校官网
              </button>
              <button
                onClick={() => handleLoadTemplate('simple')}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                简单页面
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleSave}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-bold"
              >
                💾 保存配置
              </button>
              <button
                onClick={() => {
                  setContent(device.webContent || '');
                  setIsEditing(false);
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 font-bold"
              >
                ❌ 取消
              </button>
            </div>
          </>
        ) : (
          <div className="border border-gray-300 rounded p-4 bg-gray-50">
            {content ? (
              showPreview ? (
                // 预览模式：显示渲染后的网页
                <div className="border border-gray-300 rounded overflow-hidden bg-white">
                  <iframe
                    srcDoc={content}
                    title="网页预览"
                    className="w-full h-96 bg-white"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                // 代码模式：显示HTML代码片段
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap text-gray-700">
                  {content.substring(0, 200)}
                  {content.length > 200 && '...'}
                </pre>
              )
            ) : (
              <p className="text-gray-500 text-center py-4">
                暂无网页内容，点击"编辑"按钮添加
              </p>
            )}
          </div>
        )}
      </div>

      {/* 教学提示 */}
      <div className="p-3 bg-green-50 rounded border border-green-200">
        <p className="text-sm text-green-800">
          <strong>💡 教学要点：</strong>
        </p>
        <ul className="text-xs text-green-700 mt-1 ml-4 space-y-1">
          <li>• Web服务器提供网页内容，浏览器通过HTTP协议访问</li>
          <li>• 端口80是HTTP的默认端口，443是HTTPS的默认端口</li>
          <li>• 一个Web服务器可以绑定一个域名（需DNS解析）</li>
          <li>• 对应课本第9课《数据传输有新意》和第11-13课万维网</li>
        </ul>
      </div>
    </div>
  );
};
