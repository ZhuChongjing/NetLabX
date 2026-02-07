// 临时脚本：导出教学拓扑为JSON
// 运行方式: node export-teaching-scenario.js

import { loadTeachingScenario } from './src/utils/scenarioLoader.ts';
import fs from 'fs';

const scenario = loadTeachingScenario();

// 格式化为适合导入的JSON格式
const exportData = {
  id: scenario.id,
  name: scenario.name,
  description: scenario.description,
  devices: scenario.devices,
  connections: scenario.connections,
  isExamMode: false
};

const jsonString = JSON.stringify(exportData, null, 2);
const outputPath = './教学示例文件夹/01-阿珍阿强家庭网络.json';

fs.writeFileSync(outputPath, jsonString, 'utf-8');
console.log(`✅ 成功导出教学拓扑到: ${outputPath}`);
console.log(`📊 设备数量: ${scenario.devices.length}`);
console.log(`🔗 连接数量: ${scenario.connections.length}`);
