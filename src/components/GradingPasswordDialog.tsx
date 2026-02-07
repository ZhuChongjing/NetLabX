import React, { useState } from 'react';

interface GradingPasswordDialogProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const GradingPasswordDialog: React.FC<GradingPasswordDialogProps> = ({ onSuccess, onCancel }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/auth/grading', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onSuccess();
      } else {
        setError(data.error || '密码错误');
        setPassword('');
      }
    } catch (error) {
      console.error('验证失败:', error);
      setError('无法连接服务器，请确保后端服务正在运行');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">🔒 教师身份验证</h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          请输入批改作业的密码
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="请输入密码"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {loading ? '验证中...' : '确认'}
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <p className="font-bold mb-1">💡 提示：</p>
          <p>• 如需修改密码，请编辑 server.js 文件第21行的字符串</p>
          <p>• 修改后需要重启后端服务才能生效</p>
        </div>
      </div>
    </div>
  );
};
