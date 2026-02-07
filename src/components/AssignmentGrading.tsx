import React, { useState, useEffect, useRef } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';

interface Assignment {
  filename: string;
  studentInfo: {
    name: string;
    studentId: string;
    className: string;
    examType?: string; // 新增：试卷类型（新格式数据）
    submitTime: string;
    clientIP: string;
  };
  topology: {
    devices: any[];
    connections: any[];
  };
}

interface GradeData {
  grade: string;
  comment: string;
  gradedTime: string;
  examType?: string; // 试卷类型：B, A, A+
  studentName?: string; // 学生姓名（不含试卷类型后缀）
}

const GRADE_OPTIONS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-'];

// 从姓名末尾提取试卷类型（如 "张三B" -> { name: "张三", examType: "B" }）
const extractExamTypeFromName = (fullName: string): { name: string; examType: string } => {
  // 匹配末尾的 B, A, A+ 等试卷类型
  const match = fullName.match(/^(.+?)(B|A\+|A)$/);
  if (match) {
    return { name: match[1], examType: match[2] };
  }
  return { name: fullName, examType: '' };
};

// 从文件名提取试卷类型（如 "15_卢曦乐_A+.json" -> "A+"）
const extractExamTypeFromFilename = (filename: string): string => {
  // 匹配 学号_姓名_试卷类型.json 格式
  // 支持 B, A, A+ 三种类型（大小写不敏感）
  const match = filename.match(/_(B|A\+|A)\.json$/i);
  if (match) {
    // 标准化大小写
    const type = match[1].toUpperCase();
    return type;
  }
  return '';
};

// 获取试卷类型和纯姓名（兼容新旧数据格式）
// 优先级：1. studentInfo.examType  2. 文件名  3. 姓名末尾
const getExamTypeAndName = (assignment: Assignment): { name: string; examType: string } => {
  const studentInfo = assignment.studentInfo;

  // 1. 优先使用 studentInfo.examType（新格式）
  if (studentInfo.examType) {
    return { name: studentInfo.name, examType: studentInfo.examType };
  }

  // 2. 尝试从文件名提取（已重命名的文件）
  const filenameExamType = extractExamTypeFromFilename(assignment.filename);
  if (filenameExamType) {
    return { name: studentInfo.name, examType: filenameExamType };
  }

  // 3. 从姓名末尾提取（旧格式：姓名+试卷类型）
  return extractExamTypeFromName(studentInfo.name);
};

// 生成成绩的唯一key：学号_试卷类型
const getGradeKey = (studentId: string, examType: string): string => {
  return examType ? `${studentId}_${examType}` : studentId;
};

interface AssignmentGradingProps {
  onClose: () => void;
}

export const AssignmentGrading: React.FC<AssignmentGradingProps> = ({ onClose }) => {
  const importTopology = useNetworkStore(state => state.importTopology);
  const gradingTools = useNetworkStore(state => state.gradingTools);
  const setGradingFastMode = useNetworkStore(state => state.setGradingFastMode);
  const setGradingAutoCommentEnabled = useNetworkStore(state => state.setGradingAutoCommentEnabled);
  const setActiveGradingStudent = useNetworkStore(state => state.setActiveGradingStudent);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [className, setClassName] = useState('');
  const [date, setDate] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [grades, setGrades] = useState<Record<string, GradeData>>({});
  const [currentGrade, setCurrentGrade] = useState('');
  const [currentComment, setCurrentComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const autoCommentAppliedRef = useRef(0);
  const currentAssignment = assignments[currentIndex];
  const gradedCount = Object.keys(grades).length;

  useEffect(() => {
    return () => {
      setActiveGradingStudent(null);
    };
  }, [setActiveGradingStudent]);

  useEffect(() => {
    autoCommentAppliedRef.current = 0;
  }, [currentAssignment?.studentInfo.studentId]);

  // 自动应用诊断评语
  useEffect(() => {
    if (!gradingTools.autoCommentEnabled) return;
    if (!currentAssignment) return;
    if (!gradingTools.autoCommentDraft) return;
    if (gradingTools.commentOwnerId !== currentAssignment.studentInfo.studentId) return;
    if (gradingTools.lastUpdatedAt <= autoCommentAppliedRef.current) return;

    setCurrentComment(gradingTools.autoCommentDraft);
    autoCommentAppliedRef.current = gradingTools.lastUpdatedAt;
  }, [
    gradingTools.autoCommentDraft,
    gradingTools.autoCommentEnabled,
    gradingTools.commentOwnerId,
    gradingTools.lastUpdatedAt,
    currentAssignment?.studentInfo.studentId
  ]);

  // 初始加载：获取可用班级列表
  useEffect(() => {
    fetchAvailableClasses();
  }, []);

  // 当班级改变时，获取该班级的日期列表
  useEffect(() => {
    if (className) {
      fetchAvailableDates(className);
    }
  }, [className]);

  // 获取可用班级列表
  const fetchAvailableClasses = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/classes');
      const data = await response.json();

      if (data.classes && data.classes.length > 0) {
        setAvailableClasses(data.classes);
        setClassName(data.classes[0]); // 默认选择第一个班级
      } else {
        setMessage('⚠️ 未找到任何班级作业，请确认submissions目录');
      }
    } catch (error) {
      console.error('获取班级列表失败:', error);
      setMessage('❌ 无法连接服务器，请确保后端服务正在运行');
    }
  };

  // 获取某个班级的日期列表
  const fetchAvailableDates = async (classNum: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/dates/${classNum}`);
      const data = await response.json();

      if (data.dates && data.dates.length > 0) {
        setAvailableDates(data.dates);
        setDate(data.dates[0]); // 默认选择最新日期
      } else {
        setAvailableDates([]);
        setDate('');
        setMessage(`⚠️ 七年级${classNum}班暂无作业提交记录`);
      }
    } catch (error) {
      console.error('获取日期列表失败:', error);
      setMessage('❌ 获取日期列表失败');
    }
  };

  // 加载作业列表
  const loadAssignments = async () => {
    if (!className || !date) {
      setMessage('⚠️ 请先选择班级和日期');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`http://localhost:3001/api/assignments/${className}/${date}`);
      const data = await response.json();

      if (data.assignments && data.assignments.length > 0) {
        setAssignments(data.assignments);

        // 尝试获取已有成绩，找到第一个未批改的作业
        let startIndex = 0;
        try {
          const gradesResponse = await fetch(`http://localhost:3001/api/grades/${className}/${date}`);
          if (gradesResponse.ok) {
            const gradesData = await gradesResponse.json();
            setGrades(gradesData.grades || {});

            // 查找第一个未批改的作业（使用 学号_试卷类型 作为key）
            const firstUngradedIndex = data.assignments.findIndex((assignment: Assignment) => {
              const { examType } = getExamTypeAndName(assignment);
              const gradeKey = getGradeKey(assignment.studentInfo.studentId, examType);
              return !gradesData.grades[gradeKey];
            });

            if (firstUngradedIndex !== -1) {
              startIndex = firstUngradedIndex;
              setMessage(`✅ 加载成功：共 ${data.assignments.length} 份作业，已批改 ${Object.keys(gradesData.grades || {}).length} 份，跳转到第 ${startIndex + 1} 份（未批改）`);
            } else {
              setMessage(`✅ 加载成功：共 ${data.assignments.length} 份作业，全部已批改 ✨`);
            }
          } else {
            setMessage(`✅ 加载成功：共 ${data.assignments.length} 份作业`);
          }
        } catch (err) {
          // 获取成绩失败，从头开始
          setMessage(`✅ 加载成功：共 ${data.assignments.length} 份作业`);
        }

        setCurrentIndex(startIndex);

        // 加载对应作业到画布
        if (data.assignments[startIndex]) {
          loadAssignmentToCanvas(data.assignments[startIndex]);
        }
      } else {
        setAssignments([]);
        setMessage('⚠️ 未找到作业，请检查班级和日期');
        setActiveGradingStudent(null);
      }
    } catch (error) {
      console.error('加载作业失败:', error);
      setMessage('❌ 加载失败，请确保服务器正在运行');
    } finally {
      setLoading(false);
    }
  };

  // 加载作业到画布
  const loadAssignmentToCanvas = (assignment: Assignment) => {
    const jsonData = JSON.stringify({
      studentInfo: assignment.studentInfo,
      topology: assignment.topology
    });
    importTopology(jsonData);

    // 从grades中加载已有成绩（如果存在）
    // 使用 学号_试卷类型 作为key
    const studentId = assignment.studentInfo.studentId;
    const { examType } = getExamTypeAndName(assignment);
    const gradeKey = getGradeKey(studentId, examType);

    setActiveGradingStudent(studentId);
    if (grades[gradeKey]) {
      setCurrentGrade(grades[gradeKey].grade);
      setCurrentComment(grades[gradeKey].comment);
    } else {
      setCurrentGrade('');
      setCurrentComment('');
    }
  };

  // 切换作业
  const navigateAssignment = (direction: 'prev' | 'next') => {
    let newIndex = currentIndex;
    if (direction === 'prev' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'next' && currentIndex < assignments.length - 1) {
      newIndex = currentIndex + 1;
    }

    setCurrentIndex(newIndex);
    loadAssignmentToCanvas(assignments[newIndex]);
  };

  // 保存成绩
  const saveGrade = async () => {
    if (!currentGrade) {
      alert('请选择成绩等级');
      return;
    }

    const currentAssignment = assignments[currentIndex];
    const studentId = currentAssignment.studentInfo.studentId;
    const { name: studentName, examType } = getExamTypeAndName(currentAssignment);
    const gradeKey = getGradeKey(studentId, examType);

    try {
      const response = await fetch(`http://localhost:3001/api/grade/${className}/${date}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          examType, // 新增：试卷类型
          studentName, // 新增：纯姓名（不含试卷类型后缀）
          grade: currentGrade,
          comment: currentComment
        })
      });

      const result = await response.json();
      if (result.success) {
        // 更新本地grades状态（使用 学号_试卷类型 作为key）
        setGrades(prev => ({
          ...prev,
          [gradeKey]: {
            grade: currentGrade,
            comment: currentComment,
            gradedTime: new Date().toISOString(),
            examType,
            studentName
          }
        }));

        setMessage(`✅ 成绩已保存：${studentName}${examType ? `(${examType})` : ''} - ${currentGrade}`);

        // 自动切换到下一个（如果有）
        if (currentIndex < assignments.length - 1) {
          setTimeout(() => {
            navigateAssignment('next');
          }, 500);
        }
      }
    } catch (error) {
      console.error('保存成绩失败:', error);
      setMessage('❌ 保存失败，请检查服务器连接');
    }
  };

  // 导出Excel
  const exportExcel = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/grades/${className}/${date}/export`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `七年级${className}班_${date}_成绩.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setMessage('✅ 成绩表已导出');
      } else {
        setMessage('❌ 导出失败，可能还没有成绩记录');
      }
    } catch (error) {
      console.error('导出Excel失败:', error);
      setMessage('❌ 导出失败');
    }
  };

  const handleClosePanel = () => {
    setActiveGradingStudent(null);
    onClose();
  };

  return (
    <div
      className={`fixed top-0 left-0 h-screen bg-white shadow-2xl transition-all duration-300 z-40 overflow-y-auto border-r-2 border-gray-300 ${
        isCollapsed ? 'w-12' : 'w-80'
      }`}
    >
      {/* 折叠/展开按钮 - 移到右侧中间位置 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:from-blue-600 hover:to-purple-600 shadow-lg z-50 transition-all"
        title={isCollapsed ? '展开批改面板' : '折叠批改面板'}
      >
        {isCollapsed ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        )}
      </button>

      {/* 折叠状态 - 只显示竖排标题 */}
      {isCollapsed && (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="transform rotate-90 whitespace-nowrap text-lg font-bold text-gray-700">
            📝 批改作业
          </div>
        </div>
      )}

      {/* 展开状态 - 完整内容 */}
      {!isCollapsed && (
        <div className="p-4">
          {/* 标题栏 */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-200">
            <h2 className="text-lg font-bold text-gray-800">📝 批改作业</h2>
            <button
              onClick={handleClosePanel}
              className="text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full w-8 h-8 flex items-center justify-center transition-all"
              title="关闭批改模式"
            >
              ✕
            </button>
          </div>

          {/* 加载作业区域 */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <h3 className="font-bold text-gray-800 mb-2 text-sm">📂 加载作业</h3>

            {/* 班级选择 */}
            <div className="mb-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">班级</label>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                disabled={availableClasses.length === 0}
              >
                {availableClasses.length === 0 ? (
                  <option value="">-- 暂无班级 --</option>
                ) : (
                  availableClasses.map(num => (
                    <option key={num} value={num}>七年级{num}班</option>
                  ))
                )}
              </select>
            </div>

            {/* 日期选择 */}
            <div className="mb-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">日期</label>
              <select
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                disabled={availableDates.length === 0}
              >
                {availableDates.length === 0 ? (
                  <option value="">-- 暂无日期 --</option>
                ) : (
                  availableDates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))
                )}
              </select>
            </div>

            {/* 加载按钮 */}
            <button
              onClick={loadAssignments}
              disabled={loading || !className || !date}
              className="w-full bg-blue-600 text-white py-1.5 px-3 rounded text-sm hover:bg-blue-700 transition disabled:bg-gray-400 font-bold"
            >
              {loading ? '加载中...' : '📥 加载作业'}
            </button>

            {/* 消息提示 */}
            {message && (
              <div className={`text-xs p-2 rounded mt-2 ${
                message.includes('❌') ? 'bg-red-100 text-red-700' :
                message.includes('⚠️') ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {message}
              </div>
            )}
          </div>

          {/* 批改区域 */}
          {assignments.length > 0 && currentAssignment && (
            <>
              {/* 学生信息 */}
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg p-3 mb-3">
                <div className="text-xs space-y-1">
                  {/* 显示试卷类型标签 */}
                  {(() => {
                    const { name, examType } = getExamTypeAndName(currentAssignment);
                    return (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="opacity-80">姓名：</span>
                          <span className="font-bold flex items-center gap-1">
                            {name}
                            {examType && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                examType === 'A+' ? 'bg-yellow-400 text-yellow-900' :
                                examType === 'A' ? 'bg-green-400 text-green-900' :
                                'bg-blue-400 text-blue-900'
                              }`}>
                                {examType}级
                              </span>
                            )}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="flex justify-between">
                    <span className="opacity-80">学号：</span>
                    <span className="font-bold">{currentAssignment.studentInfo.studentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-80">提交：</span>
                    <span className="font-bold text-[10px]">
                      {new Date(currentAssignment.studentInfo.submitTime).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="opacity-80">进度：</span>
                    <span className="font-bold">
                      {currentIndex + 1}/{assignments.length} ({gradedCount}/{assignments.length}已批)
                    </span>
                  </div>
                  {/* 当前作业批改状态 */}
                  {(() => {
                    const { examType } = getExamTypeAndName(currentAssignment);
                    const gradeKey = getGradeKey(currentAssignment.studentInfo.studentId, examType);
                    return grades[gradeKey] && (
                      <div className="flex justify-between items-center bg-green-400 bg-opacity-30 rounded px-2 py-1 mt-1">
                        <span className="text-xs">✅ 已批改{examType ? `(${examType})` : ''}</span>
                        <span className="font-bold">{grades[gradeKey].grade}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 批改辅助 */}
              <div className="bg-yellow-50 rounded-lg p-3 mb-3 border border-yellow-200">
                <h3 className="font-bold text-gray-800 mb-2 text-sm">⚙️ 批改辅助工具</h3>
                <div className="space-y-2 text-xs text-gray-700">
                  <label className="flex items-center justify-between">
                    <span>⚡ 快速动画模式</span>
                    <input
                      type="checkbox"
                      checked={gradingTools.fastMode}
                      onChange={(e) => setGradingFastMode(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>🧠 自动诊断写评语</span>
                    <input
                      type="checkbox"
                      checked={gradingTools.autoCommentEnabled}
                      onChange={(e) => setGradingAutoCommentEnabled(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                    />
                  </label>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    运行 Ping / DNS / HTTP 测试会自动把诊断结果填入评语框，您可随时手动修改或覆盖。
                  </p>
                  {gradingTools.autoCommentEnabled &&
                    gradingTools.autoCommentDraft &&
                    gradingTools.commentOwnerId === currentAssignment.studentInfo.studentId && (
                      <div className="mt-1 p-2 bg-white rounded border border-yellow-200 text-[11px] text-gray-600 whitespace-pre-line">
                        {gradingTools.autoCommentDraft}
                      </div>
                    )}
                </div>
              </div>

              {/* 成绩选择 */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <h3 className="font-bold text-gray-800 mb-2 text-sm">🎯 评分</h3>
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {GRADE_OPTIONS.map(grade => (
                    <button
                      key={grade}
                      onClick={() => setCurrentGrade(grade)}
                      className={`py-1 px-2 rounded text-xs font-bold transition ${
                        currentGrade === grade
                          ? 'bg-green-600 text-white scale-105'
                          : 'bg-white text-gray-700 border border-gray-300 hover:border-green-500'
                      }`}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    评语（选填）
                  </label>
                  <textarea
                    value={currentComment}
                    onChange={(e) => setCurrentComment(e.target.value)}
                    placeholder="如：拓扑清晰，路由配置正确..."
                    rows={2}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 导航和操作按钮 */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => navigateAssignment('prev')}
                    disabled={currentIndex === 0}
                    className="flex-1 px-2 py-1.5 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ⬅️ 上一个
                  </button>
                  <button
                    onClick={() => navigateAssignment('next')}
                    disabled={currentIndex === assignments.length - 1}
                    className="flex-1 px-2 py-1.5 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一个 ➡️
                  </button>
                </div>

                <button
                  onClick={saveGrade}
                  className="w-full bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700 transition font-bold"
                >
                  ✅ 保存成绩{currentGrade && ` (${currentGrade})`}
                </button>

                <button
                  onClick={exportExcel}
                  className="w-full bg-indigo-600 text-white py-1.5 px-3 rounded text-xs hover:bg-indigo-700 transition"
                >
                  📊 导出成绩表 (Excel)
                </button>
              </div>
            </>
          )}

          {/* 空状态 */}
          {assignments.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-xs">请选择班级和日期<br/>然后点击"加载作业"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
