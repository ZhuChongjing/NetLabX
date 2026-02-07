/**
 * 简单的Node.js服务器
 * 用于接收学生作业提交并保存到submissions/目录
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import ExcelJS from 'exceljs';

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001; // 使用3001端口，避免与Vite的5173冲突

// 批改作业密码（如需修改，直接修改下面的字符串即可）
const GRADING_PASSWORD = 'teacher123';

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 支持较大的JSON数据

// 确保submissions目录存在
const submissionsDir = path.join(__dirname, 'submissions');
if (!fs.existsSync(submissionsDir)) {
  fs.mkdirSync(submissionsDir, { recursive: true });
  console.log('📁 创建提交目录:', submissionsDir);
}

// API: 批改作业密码验证
app.post('/api/auth/grading', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: '请输入密码' });
    }

    if (password === GRADING_PASSWORD) {
      console.log('✅ 批改作业权限验证通过');
      res.json({ success: true, message: '验证成功' });
    } else {
      console.log('❌ 批改作业密码错误');
      res.status(401).json({ success: false, error: '密码错误' });
    }
  } catch (error) {
    console.error('❌ 验证失败:', error);
    res.status(500).json({ error: '服务器错误', message: error.message });
  }
});

// API: 获取客户端IP地址
app.get('/api/get-client-ip', (req, res) => {
  // 尝试多种方式获取真实IP
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    '未知IP';

  // 清理IPv6前缀
  const cleanIP = ip.replace('::ffff:', '');

  res.json({ ip: cleanIP });
});

// API: 提交作业
app.post('/api/submit-assignment', (req, res) => {
  try {
    const { filename, data } = req.body;

    if (!filename || !data) {
      return res.status(400).json({ error: '缺少文件名或数据' });
    }

    // ✅ 使用服务端时间，覆盖客户端时间
    const serverTime = new Date().toISOString();
    if (data.studentInfo) {
      data.studentInfo.submitTime = serverTime;
    }

    // filename格式: 七年级1班/2025-01-09/192.168.1.100_张三_20250109143022.json
    // 提取班级和日期路径
    const filePath = path.join(submissionsDir, filename);
    const fileDir = path.dirname(filePath);

    // 确保目录存在（递归创建班级和日期目录）
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
      console.log(`📁 创建目录: ${fileDir}`);
    }

    // 保存文件（使用服务端时间）
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`✅ 收到作业提交: ${filename}`);
    console.log(`   学生: ${data.studentInfo?.name || '未知'}`);
    console.log(`   学号: ${data.studentInfo?.studentId || '未知'}`);
    console.log(`   班级: 七年级${data.studentInfo?.className || '未知'}班`);
    console.log(`   服务端时间: ${serverTime}`);
    console.log(`   设备数: ${data.topology?.devices?.length || 0}`);

    res.json({
      success: true,
      message: '作业提交成功',
      filename: filename,
      serverTime: serverTime // 返回服务端时间给客户端确认
    });
  } catch (error) {
    console.error('❌ 保存作业失败:', error);
    res.status(500).json({
      error: '服务器错误',
      message: error.message
    });
  }
});

// API: 获取所有可用的班级列表
app.get('/api/classes', (req, res) => {
  try {
    if (!fs.existsSync(submissionsDir)) {
      return res.json({ classes: [] });
    }

    // 读取submissions目录下所有文件夹
    const items = fs.readdirSync(submissionsDir, { withFileTypes: true });
    const classes = items
      .filter(item => item.isDirectory() && item.name.startsWith('七年级'))
      .map(item => {
        // 提取班级编号，如"七年级1班" -> "1"
        const match = item.name.match(/七年级(\d+)班/);
        return match ? match[1] : null;
      })
      .filter(Boolean)
      .sort((a, b) => parseInt(a) - parseInt(b));

    res.json({ classes });
  } catch (error) {
    console.error('❌ 获取班级列表失败:', error);
    res.status(500).json({ error: '服务器错误', message: error.message });
  }
});

// API: 获取某个班级的所有日期列表
app.get('/api/dates/:className', (req, res) => {
  try {
    const { className } = req.params;
    const classDir = path.join(submissionsDir, `七年级${className}班`);

    if (!fs.existsSync(classDir)) {
      return res.json({ dates: [] });
    }

    // 读取班级目录下所有日期文件夹
    const items = fs.readdirSync(classDir, { withFileTypes: true });
    const dates = items
      .filter(item => item.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(item.name))
      .map(item => item.name)
      .sort()
      .reverse(); // 最新日期在前

    res.json({ dates });
  } catch (error) {
    console.error('❌ 获取日期列表失败:', error);
    res.status(500).json({ error: '服务器错误', message: error.message });
  }
});

// API: 获取班级某一天的所有作业
app.get('/api/assignments/:className/:date', (req, res) => {
  try {
    const { className, date } = req.params;
    const classDir = path.join(submissionsDir, `七年级${className}班`, date);

    if (!fs.existsSync(classDir)) {
      return res.json({ assignments: [] });
    }

    // 读取目录下所有JSON文件（排除grades.json）
    const files = fs.readdirSync(classDir)
      .filter(file => file.endsWith('.json') && file !== 'grades.json');

    const assignments = files.map(file => {
      const filePath = path.join(classDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        filename: file,
        studentInfo: content.studentInfo,
        topology: content.topology
      };
    });

    // 按学号排序，同一学号按试卷类型排序（B < A < A+）
    const examOrder = { 'B': 1, 'A': 2, 'A+': 3, '': 0 };
    assignments.sort((a, b) => {
      const idA = parseInt(a.studentInfo.studentId) || 0;
      const idB = parseInt(b.studentInfo.studentId) || 0;
      if (idA !== idB) return idA - idB;

      // 同一学号，按试卷类型排序
      // 优先从 studentInfo.examType 获取，否则从文件名提取
      const getExamType = (item) => {
        if (item.studentInfo.examType) return item.studentInfo.examType;
        const match = item.filename.match(/_(B|A\+|A)\.json$/i);
        return match ? match[1].toUpperCase() : '';
      };
      const typeA = getExamType(a);
      const typeB = getExamType(b);
      return (examOrder[typeA] || 0) - (examOrder[typeB] || 0);
    });

    res.json({ assignments });
  } catch (error) {
    console.error('❌ 获取作业列表失败:', error);
    res.status(500).json({ error: '服务器错误', message: error.message });
  }
});

// API: 获取某个班级某天的成绩
app.get('/api/grades/:className/:date', (req, res) => {
  try {
    const { className, date } = req.params;
    const classDir = path.join(submissionsDir, `七年级${className}班`, date);
    const gradesFile = path.join(classDir, 'grades.json');

    if (!fs.existsSync(gradesFile)) {
      return res.json({ grades: {} }); // 返回空对象而不是404
    }

    const grades = JSON.parse(fs.readFileSync(gradesFile, 'utf-8'));
    res.json({ grades });
  } catch (error) {
    console.error('❌ 获取成绩失败:', error);
    res.status(500).json({ error: '服务器错误', message: error.message });
  }
});

// API: 保存成绩
// 支持同一学生多份试卷（B/A/A+），使用 学号_试卷类型 作为key
app.post('/api/grade/:className/:date', (req, res) => {
  try {
    const { className, date } = req.params;
    const { studentId, examType, studentName, grade, comment } = req.body;

    if (!studentId || !grade) {
      return res.status(400).json({ error: '缺少学号或成绩' });
    }

    const classDir = path.join(submissionsDir, `七年级${className}班`, date);
    const gradesFile = path.join(classDir, 'grades.json');

    // 读取现有成绩（如果存在）
    let gradesData = {};
    if (fs.existsSync(gradesFile)) {
      gradesData = JSON.parse(fs.readFileSync(gradesFile, 'utf-8'));
    }

    // 生成成绩key：学号_试卷类型（如 4_B, 4_A+）
    const gradeKey = examType ? `${studentId}_${examType}` : studentId;

    // 更新成绩
    gradesData[gradeKey] = {
      grade,
      comment: comment || '',
      gradedTime: new Date().toISOString(),
      studentId, // 保留原始学号，方便导出时排序
      examType: examType || '', // 试卷类型
      studentName: studentName || '' // 纯姓名（不含试卷类型后缀）
    };

    // 保存成绩文件
    fs.writeFileSync(gradesFile, JSON.stringify(gradesData, null, 2), 'utf-8');

    console.log(`✅ 成绩已保存: 学号${studentId}${examType ? `(${examType})` : ''} - ${grade}`);

    res.json({ success: true, message: '成绩已保存' });
  } catch (error) {
    console.error('❌ 保存成绩失败:', error);
    res.status(500).json({ error: '服务器错误', message: error.message });
  }
});

// API: 导出成绩为Excel
// 支持同一学生多份试卷，按学号排序，同一学生的不同试卷连续显示
// 新增：提交时间列，成绩列红色字体
app.get('/api/grades/:className/:date/export', async (req, res) => {
  try {
    const { className, date } = req.params;
    const classDir = path.join(submissionsDir, `七年级${className}班`, date);
    const gradesFile = path.join(classDir, 'grades.json');

    if (!fs.existsSync(gradesFile)) {
      return res.status(404).json({ error: '成绩文件不存在' });
    }

    const grades = JSON.parse(fs.readFileSync(gradesFile, 'utf-8'));

    // 读取所有作业文件，提取提交时间
    const assignmentFiles = fs.readdirSync(classDir)
      .filter(file => file.endsWith('.json') && file !== 'grades.json');

    const submitTimeMap = {}; // key: 学号_试卷类型, value: submitTime
    assignmentFiles.forEach(file => {
      try {
        const filePath = path.join(classDir, file);
        const assignment = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const studentId = assignment.studentInfo?.studentId;
        const examType = assignment.studentInfo?.examType || '';
        const submitTime = assignment.studentInfo?.submitTime;

        if (studentId && submitTime) {
          const key = examType ? `${studentId}_${examType}` : studentId;
          submitTimeMap[key] = submitTime;
        }
      } catch (err) {
        console.warn(`跳过无效文件: ${file}`);
      }
    });

    // 将成绩数据转为数组并按学号排序
    const gradeEntries = Object.entries(grades).map(([key, data]) => {
      const studentId = data.studentId || key.split('_')[0];
      const examType = data.examType || (key.includes('_') ? key.split('_')[1] : '');
      const studentName = data.studentName || '';
      const submitTime = submitTimeMap[key] || ''; // 获取提交时间

      return {
        key,
        studentId,
        examType,
        studentName,
        submitTime,
        grade: data.grade,
        comment: data.comment || '',
        gradedTime: data.gradedTime
      };
    });

    // 按学号排序（数字排序），同一学号按试卷类型排序（B < A < A+）
    const examOrder = { 'B': 1, 'A': 2, 'A+': 3, '': 0 };
    gradeEntries.sort((a, b) => {
      const idA = parseInt(a.studentId) || 0;
      const idB = parseInt(b.studentId) || 0;
      if (idA !== idB) return idA - idB;
      return (examOrder[a.examType] || 0) - (examOrder[b.examType] || 0);
    });

    // 创建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('成绩表');

    // 设置列定义
    worksheet.columns = [
      { header: '学号', key: 'studentId', width: 10 },
      { header: '姓名', key: 'studentName', width: 15 },
      { header: '试卷类型', key: 'examType', width: 12 },
      { header: '提交时间', key: 'submitTime', width: 20 },
      { header: '成绩', key: 'grade', width: 10 },
      { header: '评语', key: 'comment', width: 30 },
      { header: '批改时间', key: 'gradedTime', width: 20 }
    ];

    // 设置表头样式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' } // 灰色背景
    };
    worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // 添加数据行
    gradeEntries.forEach(entry => {
      const submitTimeFormatted = entry.submitTime
        ? new Date(entry.submitTime).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          })
        : '-';

      const gradedTimeFormatted = entry.gradedTime
        ? new Date(entry.gradedTime).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          })
        : '-';

      const row = worksheet.addRow({
        studentId: entry.studentId,
        studentName: entry.studentName,
        examType: entry.examType || '-',
        submitTime: submitTimeFormatted,
        grade: entry.grade,
        comment: entry.comment,
        gradedTime: gradedTimeFormatted
      });

      // ✅ 将"成绩"列(第5列)设为红色加粗
      row.getCell(5).font = {
        bold: true,
        color: { argb: 'FFFF0000' } // 红色
      };

      // 所有单元格居中对齐
      row.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // 生成Excel文件
    const filename = `七年级${className}班_${date}_成绩.xlsx`;
    const encodedFilename = encodeURIComponent(filename);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);

    // 写入响应流
    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ 成绩表已导出: ${filename}`);
  } catch (error) {
    console.error('❌ 导出成绩失败:', error);
    res.status(500).json({ error: '服务器错误', message: error.message });
  }
});

// API: 获取教学案例列表（安全，不暴露文件路径）
app.get('/api/teaching-scenarios', (req, res) => {
  try {
    const scenariosDir = path.join(__dirname, '教学示例文件夹');

    // 检查目录是否存在
    if (!fs.existsSync(scenariosDir)) {
      console.log('⚠️ 教学示例文件夹不存在');
      return res.json({ scenarios: [] });
    }

    // 读取所有JSON文件
    const files = fs.readdirSync(scenariosDir)
      .filter(file => file.endsWith('.json'))
      .sort(); // 按文件名排序

    // 返回安全的案例列表（使用索引作为ID，不暴露文件名）
    const scenarios = files.map((file, index) => {
      try {
        const filePath = path.join(scenariosDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        return {
          id: index, // 使用索引作为安全ID
          name: content.name || file.replace('.json', ''),
          description: content.description || '教学拓扑示例'
        };
      } catch (err) {
        console.error(`❌ 读取案例失败: ${file}`, err.message);
        return null;
      }
    }).filter(Boolean); // 过滤掉读取失败的

    console.log(`✅ 获取教学案例列表成功: ${scenarios.length} 个`);
    res.json({ scenarios });
  } catch (error) {
    console.error('❌ 获取教学案例列表失败:', error);
    res.status(500).json({ error: '服务器错误', message: error.message });
  }
});

// API: 加载指定教学案例（通过安全ID，防止目录遍历）
app.get('/api/teaching-scenario/:id', (req, res) => {
  try {
    const { id } = req.params;
    const scenarioId = parseInt(id, 10);

    // 验证ID是否为有效数字
    if (isNaN(scenarioId) || scenarioId < 0) {
      return res.status(400).json({ error: '无效的案例ID' });
    }

    const scenariosDir = path.join(__dirname, '教学示例文件夹');

    if (!fs.existsSync(scenariosDir)) {
      return res.status(404).json({ error: '教学示例文件夹不存在' });
    }

    // 获取所有JSON文件（与列表API保持一致的排序）
    const files = fs.readdirSync(scenariosDir)
      .filter(file => file.endsWith('.json'))
      .sort();

    // 验证ID是否在范围内
    if (scenarioId >= files.length) {
      return res.status(404).json({ error: '案例不存在' });
    }

    // 根据ID读取对应的文件（安全，无法目录遍历）
    const filename = files[scenarioId];
    const filePath = path.join(scenariosDir, filename);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    console.log(`✅ 加载教学案例成功: ${content.name || filename}`);
    res.json({ scenario: content });
  } catch (error) {
    console.error('❌ 加载教学案例失败:', error);
    res.status(500).json({ error: '服务器错误', message: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '作业提交服务运行中' });
});

// 启动服务器 - 监听0.0.0.0以支持局域网访问
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('📚 网络综合实验平台 - 作业提交服务器');
  console.log('='.repeat(60));
  console.log(`🚀 服务器启动成功: http://0.0.0.0:${PORT}`);
  console.log(`📁 作业保存目录: ${submissionsDir}`);
  console.log(`💡 提示: 学生机通过 http://[教师机IP]:${PORT} 访问`);
  console.log('='.repeat(60));
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 服务器关闭');
  process.exit(0);
});
