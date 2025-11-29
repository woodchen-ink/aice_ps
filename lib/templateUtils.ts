/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Template } from '../App';

/**
 * 规范化模板数据，确保向后兼容
 * 自动检测分类，填充默认值
 */
export function normalizeTemplate(raw: any): Template {
  // 自动检测分类
  const category = raw.category || autoDetectCategory(raw);

  // 规范化标签
  const tags = Array.isArray(raw.tags) ? raw.tags : [];

  return {
    // 必需字段
    id: raw.id,
    name: raw.name,
    iconUrl: raw.iconUrl,
    baseUrl: raw.baseUrl,
    description: raw.description,
    prompt: raw.prompt,

    // 可选字段(带默认值)
    category,
    tags,
    author: raw.author || null,
    sourceRepo: raw.sourceRepo || null,
    caseNumber: raw.caseNumber || null,
    requiresInput: raw.requiresInput || false,
    difficulty: raw.difficulty || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

/**
 * 自动检测模板分类
 * 基于ID前缀判断
 */
function autoDetectCategory(template: any): Template['category'] {
  const id = template.id || '';

  if (id.startsWith('nano-banana-pro-')) return 'nano-banana-pro';
  if (id.startsWith('nano-banana-')) return 'nano-banana';
  if (id.startsWith('template-')) return 'official';

  return 'community';
}

/**
 * 批量规范化模板数组
 */
export function normalizeTemplates(templates: any[]): Template[] {
  return templates.map(normalizeTemplate);
}

/**
 * 按分类分组模板
 */
export function groupTemplatesByCategory(templates: Template[]): Record<string, Template[]> {
  const groups: Record<string, Template[]> = {
    official: [],
    'nano-banana-pro': [],
    'nano-banana': [],
    community: [],
  };

  templates.forEach(template => {
    const category = template.category || 'community';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(template);
  });

  return groups;
}

/**
 * 根据标签筛选模板
 */
export function filterTemplatesByTags(templates: Template[], selectedTags: string[]): Template[] {
  if (selectedTags.length === 0) return templates;

  return templates.filter(template => {
    const templateTags = template.tags || [];
    return selectedTags.some(tag => templateTags.includes(tag));
  });
}

/**
 * 搜索模板(按名称、描述、作者)
 */
export function searchTemplates(templates: Template[], query: string): Template[] {
  if (!query.trim()) return templates;

  const lowerQuery = query.toLowerCase();

  return templates.filter(template => {
    const name = template.name?.toLowerCase() || '';
    const description = template.description?.toLowerCase() || '';
    const author = template.author?.toLowerCase() || '';

    return (
      name.includes(lowerQuery) ||
      description.includes(lowerQuery) ||
      author.includes(lowerQuery)
    );
  });
}

/**
 * 获取所有唯一标签
 */
export function getAllTags(templates: Template[]): string[] {
  const tagSet = new Set<string>();

  templates.forEach(template => {
    (template.tags || []).forEach(tag => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
}

/**
 * 获取分类统计
 */
export function getCategoryStats(templates: Template[]): Record<string, number> {
  const stats: Record<string, number> = {
    official: 0,
    'nano-banana-pro': 0,
    'nano-banana': 0,
    community: 0,
  };

  templates.forEach(template => {
    const category = template.category || 'community';
    stats[category] = (stats[category] || 0) + 1;
  });

  return stats;
}

/**
 * 分类显示名称映射
 */
export const CATEGORY_LABELS: Record<string, string> = {
  official: '官方精选',
  'nano-banana-pro': 'Nano Banana Pro',
  'nano-banana': 'Nano Banana',
  community: '社区贡献',
};

/**
 * 获取分类显示名称
 */
export function getCategoryLabel(category?: string): string {
  return CATEGORY_LABELS[category || 'community'] || '未知分类';
}
