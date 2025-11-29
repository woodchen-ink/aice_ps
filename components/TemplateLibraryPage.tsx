
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Spinner from './Spinner';
import { SearchIcon } from './icons';
import { Template } from '../App';
import { motion } from 'framer-motion';


const TemplateCard: React.FC<{
  template: Template;
  onSelect: (template: Template) => void;
}> = ({ template, onSelect }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const fetchImage = async () => {
      try {
        const response = await fetch(template.iconUrl);
        if (!response.ok) throw new Error('Failed');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      } catch (error) {
         // silent fail
      }
    };
    fetchImage();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [template.iconUrl]);

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="glass-panel rounded-2xl overflow-hidden group cursor-pointer flex flex-col h-full"
      onClick={() => onSelect(template)}
    >
      <div className="aspect-video bg-gray-900/50 overflow-hidden relative">
        {imageSrc ? (
          <>
            <img src={imageSrc} alt={template.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Spinner className="w-8 h-8 text-gray-600" />
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-gray-100 group-hover:text-blue-400 transition-colors">{template.name}</h3>
        <p className="text-gray-400 mt-2 text-sm line-clamp-2 flex-1">
          {template.description}
        </p>
        <div className="mt-4 pt-4 border-t border-white/5">
             <span className="text-xs font-mono text-gray-500 bg-gray-800/50 px-2 py-1 rounded">Prompt Template</span>
        </div>
      </div>
    </motion.div>
  );
};

interface TemplateLibraryPageProps {
    onTemplateSelect: (template: Template) => void;
}

const ITEMS_PER_LOAD = 12; // 每次加载12个

const TemplateLibraryPage: React.FC<TemplateLibraryPageProps> = ({ onTemplateSelect }) => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [displayCount, setDisplayCount] = useState(ITEMS_PER_LOAD);
    const [searchQuery, setSearchQuery] = useState('');
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchTemplates = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/templates.json');
                if (!response.ok) throw new Error('Failed to load templates.');
                const data: Template[] = await response.json();
                setTemplates(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    // 搜索时重置显示数量
    useEffect(() => {
        setDisplayCount(ITEMS_PER_LOAD);
    }, [searchQuery]);

    const filteredTemplates = templates.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (template.author && template.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (template.tags && template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
    );

    const currentTemplates = filteredTemplates.slice(0, displayCount);
    const hasMore = displayCount < filteredTemplates.length;

    // 无限滚动加载更多
    const loadMore = useCallback(() => {
        if (hasMore) {
            setDisplayCount(prev => prev + ITEMS_PER_LOAD);
        }
    }, [hasMore]);

    // Intersection Observer 用于自动加载
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(loadMoreRef.current);

        return () => observer.disconnect();
    }, [loadMore, hasMore]);

    if (isLoading) {
        return <div className="w-full h-full flex justify-center items-center"><Spinner /></div>;
    }

    if (error) {
        return <div className="text-center text-red-400 bg-red-900/20 p-6 rounded-2xl border border-red-500/20 max-w-lg mx-auto mt-10">{error}</div>;
    }

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
            <div className="text-center mb-12 space-y-4">
                <h2 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 tracking-tight font-['Permanent_Marker']">
                    NB Library
                </h2>
                <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
                    探索精心策划的提示词模板库，激发您的创作灵感。
                </p>
                <div className="flex justify-center gap-4 text-sm font-mono">
                    <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/20">
                        总计: {templates.length}
                    </span>
                    {searchQuery && (
                        <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-lg border border-green-500/20">
                            匹配: {filteredTemplates.length}
                        </span>
                    )}
                </div>
            </div>
            
            {/* Search Bar */}
            <div className="mb-10 w-full max-w-2xl mx-auto relative z-10">
                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <div className="relative bg-gray-900 rounded-xl flex items-center">
                         <div className="pl-4 text-gray-500">
                            <SearchIcon className="h-5 w-5" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜索模板、风格或提示词..."
                            className="block w-full bg-transparent py-4 pl-3 pr-4 text-gray-200 placeholder-gray-500 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {currentTemplates.length > 0 ? (
                    currentTemplates.map(template => (
                        <TemplateCard
                            key={template.id}
                            template={template}
                            onSelect={onTemplateSelect}
                        />
                    ))
                ) : (
                     <div className="col-span-full text-center py-20 glass-panel rounded-3xl">
                        <p className="text-gray-400 text-lg">找不到匹配 "<span className="font-semibold text-white">{searchQuery}</span>" 的模板。</p>
                    </div>
                )}
            </div>

            {/* 无限滚动加载指示器 */}
            {hasMore && (
                <div ref={loadMoreRef} className="flex justify-center items-center gap-3 mt-16 py-8">
                    <Spinner className="w-6 h-6 text-blue-500" />
                    <span className="text-gray-400 font-mono text-sm">
                        加载更多... ({currentTemplates.length} / {filteredTemplates.length})
                    </span>
                </div>
            )}

            {/* 已加载全部 */}
            {!hasMore && filteredTemplates.length > ITEMS_PER_LOAD && (
                <div className="text-center mt-16 py-8">
                    <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-lg border border-green-500/20">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-mono text-sm">已加载全部 {filteredTemplates.length} 个模板</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateLibraryPage;
