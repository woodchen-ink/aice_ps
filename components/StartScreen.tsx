
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useMemo } from 'react';
import { UploadIcon, PaintBrushIcon, TemplateLibraryIcon, SparkleIcon, XMarkIcon, CheckIcon } from './icons';
import { generateImageFromText } from '../services/geminiService';
import Spinner from './Spinner';
import { Template } from '../App';
import { motion, AnimatePresence } from 'framer-motion';
import BatchSelector from './BatchSelector';

// Refined Template Button
const TemplateButton: React.FC<{
  template: Template;
  onSelect: (template: Template) => void;
}> = ({ template, onSelect }) => {
  const [iconSrc, setIconSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const fetchImage = async () => {
      try {
        const response = await fetch(template.iconUrl);
        if (!response.ok) throw new Error('Failed to load');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setIconSrc(objectUrl);
      } catch (error) {
        // Fail silently
      }
    };
    fetchImage();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [template.iconUrl]);

  return (
    <motion.button
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => onSelect(template)}
      className="relative group aspect-square rounded-xl overflow-hidden border border-white/10 bg-gray-800/50 shadow-lg"
      title={template.name}
    >
      {iconSrc ? (
        <>
            <img src={iconSrc} alt={template.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-2">
                <span className="text-xs text-white font-medium truncate w-full text-center">{template.name}</span>
            </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <Spinner className="w-6 h-6 text-gray-600" />
        </div>
      )}
    </motion.button>
  );
};

interface StartScreenProps {
  onFileSelect: (files: FileList | null) => void;
  onImageGenerated: (dataUrl: string) => void;
  onTemplateSelect: (template: Template) => void;
  onShowTemplateLibrary: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onFileSelect, onImageGenerated, onTemplateSelect, onShowTemplateLibrary }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string|null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [imageCount, setImageCount] = useState<number>(1);
  const [generatedCandidates, setGeneratedCandidates] = useState<string[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/templates.json');
        const data: Template[] = await response.json();
        setTemplates(data);
      } catch (error) { console.error(error); }
    };
    fetchTemplates();
  }, []);

  const displayedTemplates = useMemo(() => {
    if (templates.length <= 6) return templates;
    return [...templates].sort(() => 0.5 - Math.random()).slice(0, 6);
  }, [templates]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.clipboardData && event.clipboardData.files.length > 0) {
        const file = event.clipboardData.files[0];
        if (file.type.startsWith('image/')) onFileSelect(event.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFileSelect]);

  const handleGenerate = async () => {
    if (!generationPrompt.trim()) {
        setGenerationError("请输入描述内容。");
        return;
    }
    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedCandidates(null);
    
    try {
        const urls = await generateImageFromText(generationPrompt, aspectRatio, imageCount);
        if (urls.length === 1) {
             onImageGenerated(urls[0]);
        } else {
             setGeneratedCandidates(urls);
        }
    } catch (e) {
        setGenerationError(e instanceof Error ? e.message : '生成图像时发生未知错误。');
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onFileSelect(e.dataTransfer.files);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          onFileSelect(e.target.files);
      }
  };

  const aspectRatios: { name: string; value: string }[] = [
    { name: '1:1', value: '1:1' },
    { name: '4:3', value: '4:3' },
    { name: '3:4', value: '3:4' },
    { name: '16:9', value: '16:9' },
    { name: '9:16', value: '9:16' },
    { name: '3:2', value: '3:2' },
    { name: '2:3', value: '2:3' },
    { name: '21:9', value: '21:9' },
    { name: '9:21', value: '9:21' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8 animate-fade-in relative">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Text to Image */}
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-5 glass-panel rounded-3xl p-1"
        >
            <div className="bg-gray-900/50 rounded-[22px] p-6 flex flex-col gap-5 h-full relative">
                {generatedCandidates && (
                    <div className="absolute inset-0 bg-gray-900/95 z-20 rounded-[22px] p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">选择一张图片</h3>
                            <button onClick={() => setGeneratedCandidates(null)} className="text-gray-400 hover:text-white">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 p-1">
                            {generatedCandidates.map((url, idx) => (
                                <div key={idx} className="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all" onClick={() => onImageGenerated(url)}>
                                    <img src={url} className="w-full h-full object-cover" alt={`Generated ${idx}`}/>
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <CheckIcon className="w-8 h-8 text-white drop-shadow-lg" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <SparkleIcon className="w-6 h-6 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">AI 绘画 & 修图</h3>
                </div>

                <textarea
                    value={generationPrompt}
                    onChange={(e) => setGenerationPrompt(e.target.value)}
                    placeholder="描述您想象中的画面... 例如：“赛博朋克风格的雨夜街道，霓虹灯闪烁”"
                    className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-gray-100 focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 outline-none transition-all h-40 resize-none text-lg leading-relaxed placeholder-gray-600"
                    disabled={isGenerating}
                />

                <div className="space-y-3">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">宽高比</label>
                    <div className="flex flex-wrap gap-2">
                        {aspectRatios.map(({ name, value }) => (
                            <button
                                key={value}
                                onClick={() => setAspectRatio(value)}
                                disabled={isGenerating}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                                    aspectRatio === value
                                    ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </div>

                {generationError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm">
                        {generationError}
                    </div>
                )}

                <div className="mt-auto pt-4 flex gap-3">
                    <BatchSelector count={imageCount} onChange={setImageCount} disabled={isGenerating} />
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="flex-1 btn-primary rounded-xl py-3 text-lg flex items-center justify-center gap-2 group relative overflow-hidden"
                    >
                        {isGenerating ? (
                            <>
                                <Spinner className="w-6 h-6 text-white/80" />
                                <span className="animate-pulse">正在施展魔法...</span>
                            </>
                        ) : (
                            <>
                                <PaintBrushIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                <span>立即生成</span>
                            </>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    </button>
                </div>
            </div>
        </motion.div>
        
        {/* Right: Upload & Templates */}
        <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-7 flex flex-col gap-6"
        >
            {/* Upload Zone */}
            <div
                className={`group relative glass-panel rounded-3xl p-1 transition-all duration-500 ${isDraggingOver ? 'ring-2 ring-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-[1.01]' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={handleDrop}
            >
                <div className="bg-gray-900/50 rounded-[22px] p-8 flex flex-col items-center justify-center gap-4 min-h-[240px] cursor-pointer hover:bg-gray-800/50 transition-colors border-2 border-dashed border-white/5 group-hover:border-blue-500/30"
                     onClick={() => document.getElementById('image-upload-start')?.click()}
                >
                    <div className="p-5 bg-blue-500/10 rounded-full group-hover:scale-110 transition-transform duration-300 group-hover:bg-blue-500/20">
                         <UploadIcon className="w-10 h-10 text-blue-400" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-white mb-1">上传图片开始创作</h3>
                        <p className="text-gray-400">支持拖拽、粘贴或点击上传</p>
                    </div>
                    <input id="image-upload-start" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
            </div>

            {/* Templates Quick Access */}
            {templates.length > 0 && (
                <div className="glass-panel rounded-3xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                            <TemplateLibraryIcon className="w-5 h-5 text-green-400" />
                            从模板开始
                        </h3>
                        <button 
                            onClick={onShowTemplateLibrary}
                            className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                            查看全部 &rarr;
                        </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                        {displayedTemplates.map(template => (
                            <TemplateButton 
                                key={template.id} 
                                template={template} 
                                onSelect={onTemplateSelect}
                            />
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
      </div>
    </div>
  );
};

export default StartScreen;
