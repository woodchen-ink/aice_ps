/**
 * 批量导入中文版 Nano Banana 案例
 * 适配中文 README 格式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/PicoTrex/Awesome-Nano-Banana-images/refs/heads/main';

function parseReadme(readmePath) {
  const content = fs.readFileSync(readmePath, 'utf-8');
  const templates = [];

  console.log('📖 开始解析中文 README...\n');

  // 提取 Pro 段落
  const proStart = content.indexOf('## 🍌 Nano Banana Pro 例子');
  const proEnd = content.indexOf('## 🖼️ Nano Banana 例子');

  if (proStart !== -1 && proEnd !== -1) {
    const proSection = content.slice(proStart, proEnd);
    const proCases = parseCases(proSection, true);
    templates.push(...proCases);
    console.log(`  ✅ Pro 案例: ${proCases.length} 个`);
  }

  // 提取普通段落
  const normalStart = content.indexOf('## 🖼️ Nano Banana 例子');
  const normalEnd = content.indexOf('## 🙏 Acknowledge', normalStart);

  if (normalStart !== -1) {
    const normalSection = content.slice(normalStart, normalEnd > -1 ? normalEnd : content.length);
    const normalCases = parseCases(normalSection, false);
    templates.push(...normalCases);
    console.log(`  ✅ 普通案例: ${normalCases.length} 个`);
  }

  return templates;
}

function parseCases(sectionContent, isPro) {
  const cases = [];

  // 匹配: ### 例 X: [标题](链接)（by [@作者]）
  // 或: ### 例X：标题（by @作者）
  const regex = /###\s+例\s*(\d+)[：:]\s*(?:\[([^\]]+)\]|\s*([^（\(]+?))\s*(?:\([^\)]*?\))?\s*(?:[（(]by\s*[@＠]?([^\)）]+)[)）])?/gm;

  let match;
  while ((match = regex.exec(sectionContent)) !== null) {
    const number = parseInt(match[1]);
    const title = (match[2] || match[3] || '').trim();
    const author = match[4] ? match[4].trim() : null;

    // 提取这个案例的完整内容（到下一个 ### 或结尾）
    const startIdx = match.index;
    const nextMatch = sectionContent.slice(startIdx + 10).search(/\n###\s+例\s*\d+/);
    const endIdx = nextMatch > -1 ? startIdx + 10 + nextMatch : sectionContent.length;
    const caseContent = sectionContent.slice(startIdx, endIdx);

    const template = parseSingleCase(caseContent, number, title, author, isPro);
    if (template) {
      cases.push(template);
    }
  }

  return cases;
}

function parseSingleCase(content, number, title, author, isPro) {
  // 提取提示词（代码块中）
  const promptMatch = content.match(/```([\s\S]*?)```/);
  let prompt = promptMatch ? promptMatch[1].trim() : '';

  if (!prompt || prompt.length < 10) {
    console.warn(`  ⚠️  跳过案例 ${number}: ${title} (无有效 prompt)`);
    return null;
  }

  // 检测是否需要输入
  const hasInputMarker = /\*\*输入[:：]/.test(content) ||
    /上传.*?图|输入.*?图|参考.*?图|需.*?图/.test(content + prompt);

  // 生成标签
  const tags = autoGenerateTags(title, prompt);

  // 推测难度
  const difficulty = guessDifficulty(prompt);

  return {
    id: `nano-banana${isPro ? '-pro' : ''}-${number}`,
    name: title,
    iconUrl: `${GITHUB_RAW_BASE}/images/${isPro ? 'pro_case' : 'case'}${number}/output.jpg`,
    baseUrl: `${GITHUB_RAW_BASE}/images/${isPro ? 'pro_case' : 'case'}${number}/${hasInputMarker ? 'input' : 'output'}.jpg`,
    description: `${title}${author ? ` - 来自 @${author}` : ''}`,
    prompt,
    category: isPro ? 'nano-banana-pro' : 'nano-banana',
    tags,
    author: author ? `@${author}` : null,
    sourceRepo: 'PicoTrex/Awesome-Nano-Banana-images',
    caseNumber: number,
    requiresInput: hasInputMarker,
    difficulty,
    createdAt: new Date().toISOString(),
  };
}

function autoGenerateTags(title, prompt) {
  const text = (title + ' ' + prompt).toLowerCase();
  const tags = new Set();

  const tagMap = {
    '手办|figure|figurine': '手办',
    '卡牌|card|trading': '卡牌',
    '贴纸|sticker': '贴纸',
    '修复|restore|repair': '修复',
    '写实|realistic|photo': '写实',
    '动漫|anime|cartoon': '动漫',
    '浮世绘|ukiyo': '浮世绘',
    '全息|hologram': '全息',
    '复古|vintage|retro': '复古',
    '地图|map|location': '地图',
    '角色|character|人物': '角色',
    '场景|scene|environment': '场景',
    '设计|design': '设计',
    '漫画|comic|manga': '漫画',
    '海报|poster': '海报',
    '玩具|toy': '玩具',
  };

  Object.entries(tagMap).forEach(([keywords, tag]) => {
    if (new RegExp(keywords, 'i').test(text)) {
      tags.add(tag);
    }
  });

  if (tags.size === 0) tags.add('创意');

  return Array.from(tags).slice(0, 5);
}

function guessDifficulty(prompt) {
  const len = prompt.length;
  const complex = /复杂|精确|详细|多|specific|exact|complex/i.test(prompt);
  const hasVariables = (prompt.match(/\{[^}]+\}/g) || []).length;

  if (len > 600 || hasVariables > 3 || complex) return 'hard';
  if (len < 200) return 'easy';
  return 'medium';
}

function main() {
  console.log('🚀 开始批量导入中文 Nano Banana 案例...\n');

  const readmePath = path.join(__dirname, 'nano-banana-readme.md');
  const templatesPath = path.join(__dirname, '../public/templates.json');

  if (!fs.existsSync(readmePath)) {
    console.error(`❌ README 不存在: ${readmePath}`);
    process.exit(1);
  }

  // 解析
  const templates = parseReadme(readmePath);

  console.log(`\n📊 解析完成: 共 ${templates.length} 个案例`);

  // 保存临时文件
  const tempPath = path.join(__dirname, 'parsed-templates.json');
  fs.writeFileSync(tempPath, JSON.stringify(templates, null, 2), 'utf-8');
  console.log(`💾 临时文件: ${tempPath}\n`);

  // 合并
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));
  } catch (e) {
    console.error('❌ 无法读取现有模板');
    process.exit(1);
  }

  const existingIds = new Set(existing.map(t => t.id));
  const newTemplates = templates.filter(t => !existingIds.has(t.id));

  const merged = [...existing, ...newTemplates];
  fs.writeFileSync(templatesPath, JSON.stringify(merged, null, 2), 'utf-8');

  console.log(`✅ 导入完成!`);
  console.log(`  新增: ${newTemplates.length}`);
  console.log(`  总计: ${merged.length}\n`);

  const stats = {
    official: merged.filter(t => !t.category || t.category === 'official').length,
    pro: merged.filter(t => t.category === 'nano-banana-pro').length,
    normal: merged.filter(t => t.category === 'nano-banana').length,
  };

  console.log('📈 统计:');
  console.log(`  官方: ${stats.official}`);
  console.log(`  Pro: ${stats.pro}`);
  console.log(`  Normal: ${stats.normal}`);
}

main();
