import React, { useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';

interface AssignmentSubmissionProps {
  onClose: () => void;
}

export const AssignmentSubmission: React.FC<AssignmentSubmissionProps> = ({ onClose }) => {
  const { exportTopology } = useNetworkStore();
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [className, setClassName] = useState(''); // ✅ 改为空字符串，强制选择
  const [examType, setExamType] = useState(''); // 试卷类型：空=普通作业, B, A, A+
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async () => {
    // 验证输入
    if (!studentName.trim()) {
      alert('请填写姓名！');
      return;
    }

    if (!studentId.trim()) {
      alert('请填写学号！');
      return;
    }

    // ✅ 新增：验证班级是否选择
    if (!className.trim()) {
      alert('请选择班级！');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // 导出当前拓扑配置
      const topologyJSON = exportTopology();

      // 获取客户端IP地址（从浏览器URL获取）
      // 学生访问 http://192.168.1.100:5173 时，hostname就是学生机的访问IP
      // 对于localhost访问，使用后端API获取真实IP
      let clientIP = window.location.hostname;

      if (clientIP === 'localhost' || clientIP === '127.0.0.1') {
        // 如果是localhost，尝试从后端获取真实IP
        try {
          const response = await fetch('/api/get-client-ip');
          if (response.ok) {
            const data = await response.json();
            clientIP = data.ip;
          }
        } catch (error) {
          console.warn('无法获取真实IP，使用localhost:', error);
        }
      }

      // 清理IPv6格式
      clientIP = clientIP.replace('::ffff:', '');

      // 生成文件名和路径: 七年级[X]班/2025-01-09/[学号]_[姓名]_[试卷类型].json
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const folderPath = `七年级${className}班/${dateStr}`;
      // 文件名格式：学号_姓名_试卷类型.json 或 学号_姓名.json（普通作业）
      const filename = examType
        ? `${folderPath}/${studentId}_${studentName}_${examType}.json`
        : `${folderPath}/${studentId}_${studentName}.json`;

      // 构建提交数据（包含学生信息和拓扑配置）
      const submissionData = {
        studentInfo: {
          name: studentName,
          studentId: studentId,
          className: className,
          examType: examType, // 新增：试卷类型（空=普通作业, B, A, A+）
          submitTime: new Date().toISOString(),
          clientIP: clientIP
        },
        topology: JSON.parse(topologyJSON)
      };

      // 发送到服务器
      const submitResponse = await fetch('/api/submit-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: filename,
          data: submissionData
        })
      });

      if (submitResponse.ok) {
        setSubmitStatus({
          success: true,
          message: `✅ 提交成功！\n文件名: ${filename}\n请等待老师批改。`
        });
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        throw new Error('服务器返回错误');
      }
    } catch (error) {
      console.error('提交失败:', error);

      // 如果服务器不可用，提供本地下载作为备选方案
      setSubmitStatus({
        success: false,
        message: '⚠️ 无法连接到教师机器，请下载配置文件并手动提交给老师。'
      });

      // 触发本地下载
      const topologyJSON = exportTopology();
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

      // 获取IP用于文件名
      let clientIP = window.location.hostname;
      if (clientIP === 'localhost' || clientIP === '127.0.0.1') {
        clientIP = 'localhost';
      }
      clientIP = clientIP.replace('::ffff:', '');

      // 文件名格式：学号_姓名_试卷类型.json 或 学号_姓名.json
      const filename = examType
        ? `七年级${className}班_${dateStr}_${studentId}_${studentName}_${examType}.json`
        : `七年级${className}班_${dateStr}_${studentId}_${studentName}.json`;

      const submissionData = {
        studentInfo: {
          name: studentName,
          studentId: studentId,
          className: className,
          examType: examType, // 新增：试卷类型
          submitTime: now.toISOString()
        },
        topology: JSON.parse(topologyJSON)
      };

      const blob = new Blob([JSON.stringify(submissionData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
        {/* 标题 */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 rounded-t-lg">
          <h2 className="text-2xl font-bold">📝 提交作业</h2>
          <p className="text-green-100 text-sm mt-1">完成信息填写后提交给老师</p>
        </div>

        {/* 表单内容 */}
        <div className="p-6 space-y-4">
          {!submitStatus ? (
            <>
              {/* 姓名 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="请输入你的姓名"
                  disabled={isSubmitting}
                />
              </div>

              {/* 学号 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  学号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={studentId}
                  onChange={(e) => {
                    // 只允许输入数字
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setStudentId(value);
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  placeholder="请输入学号（仅数字）"
                  disabled={isSubmitting}
                />
              </div>

              {/* 班级 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  班级 <span className="text-red-500">*</span>
                </label>
                <select
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                  disabled={isSubmitting}
                >
                  <option value="" disabled>请选择班级</option>
                  <option value="1">七年级1班</option>
                  <option value="2">七年级2班</option>
                  <option value="3">七年级3班</option>
                  <option value="4">七年级4班</option>
                  <option value="5">七年级5班</option>
                  <option value="6">七年级6班</option>
                  <option value="7">七年级7班</option>
                  <option value="8">七年级8班</option>
                </select>
              </div>

              {/* 试卷类型 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  作业类型
                </label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
                  disabled={isSubmitting}
                >
                  <option value="">普通作业</option>
                  <option value="B">B级试卷（基础）</option>
                  <option value="A">A级试卷（进阶）</option>
                  <option value="A+">A+级试卷（挑战）</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  如果老师没有特别说明，请选择"普通作业"
                </p>
              </div>

              {/* 提示 */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                <p className="text-sm text-blue-800">
                  <strong>提示：</strong>提交前请确保已完成所有配置和测试！
                </p>
              </div>
            </>
          ) : (
            /* 提交结果 */
            <div className={`p-4 rounded-lg border-2 ${
              submitStatus.success
                ? 'bg-green-50 border-green-500'
                : 'bg-yellow-50 border-yellow-500'
            }`}>
              <p className="text-sm whitespace-pre-line">
                {submitStatus.message}
              </p>
            </div>
          )}
        </div>

        {/* 按钮区 */}
        <div className="bg-gray-50 p-6 rounded-b-lg flex justify-end space-x-4">
          {!submitStatus && (
            <>
              <button
                onClick={onClose}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-8 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg
                         hover:from-green-700 hover:to-blue-700 font-semibold shadow-lg
                         transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? '提交中...' : '提交作业 🚀'}
              </button>
            </>
          )}
          {submitStatus && !submitStatus.success && (
            <button
              onClick={onClose}
              className="px-8 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
