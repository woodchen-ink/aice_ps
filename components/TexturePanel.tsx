
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { generateCreativeSuggestions } from '../services/geminiService';
import { SparkleIcon, ChevronDownIcon } from './icons';
import Spinner from './Spinner';
import BatchSelector from './BatchSelector';

interface TexturePanelProps {
  onApplyTexture: (prompt: string, count: number) => void;
  isLoading: boolean;
  currentImage: File;
  onError: (message: string) => void;
}

type Preset = { name: string; prompt: string };

const TexturePanel: React.FC<TexturePanelProps> = ({ onApplyTexture, isLoading, currentImage, onError }) => {
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiPresets, setAiPresets] = useState<Preset[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isPresetsVisible, setIsPresetsVisible] = useState(true);
  const [batchCount, setBatchCount] = useState(1);

  const presets: Preset[] = [
    { name: '裂纹漆', prompt: 'Apply a cracked and peeling paint texture over the image, revealing a darker layer underneath.' },
    { name: '织物', prompt: 'Overlay a realistic woven fabric texture, like canvas or burlap, across the entire image.' },
    { name: '木纹', prompt: 'Apply a rich, dark wood grain texture to the image, following the contours of the subjects.' },
    { name: '金属拉丝', prompt: 'Give the image a brushed metal texture, with subtle horizontal streaks and a metallic sheen.' },
  ];
  
  const activePrompt = selectedPresetPrompt || customPrompt;

  const handlePresetClick = (prompt: string) => {
    setSelectedPresetPrompt(prompt);
    setCustomPrompt('');
  };
  
  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomPrompt(e.target.value);
    setSelectedPresetPrompt(null);
  };

  const handleApply = () => {
    if (activePrompt) {
      onApplyTexture(activePrompt, batchCount);
    }
  };

  const handleGetSuggestions = async () => {
    setIsSuggesting(true);
    onError(''); // Clear previous errors
    try {
        const suggestions = await generateCreativeSuggestions(currentImage, 'texture');
        setAiPresets(suggestions);
        setIsPresetsVisible(true); // Show presets when new ones are loaded
    } catch (e) {
        console.error("Failed to get AI suggestions:", e);
        onError(e instanceof Error ? e.message : '获取 AI 建议失败');
    } finally {
        setIsSuggesting(false);
    }
  };

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-300">应用创意纹理</h3>
        <button
            onClick={handleGetSuggestions}
            disabled={isLoading || isSuggesting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-500 transition-colors disabled:bg-purple-800 disabled:cursor-not-allowed active:scale-95"
        >
            {isSuggesting ? (
                <>
                    <Spinner className="w-5 h-5" />
                    <span>正在获取...</span>
                </>
            ) : (
                <>
                    <SparkleIcon className="w-5 h-5" />
                    <span>获取灵感</span>
                </>
            )}
        </button>
      </div>
      
      <div className="border-t border-gray-700/50 -mx-4 px-4">
        <button 
          className="w-full flex justify-between items-center py-3 text-left focus:outline-none"
          onClick={() => setIsPresetsVisible(!isPresetsVisible)}
          aria-expanded={isPresetsVisible}
          aria-controls="texture-presets"
        >
          <h4 className="text-md font-semibold text-gray-300 hover:text-white transition-colors">纹理预设</h4>
          <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isPresetsVisible ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div 
        id="texture-presets"
        className={`grid gap-4 transition-all duration-300 ease-in-out overflow-hidden ${isPresetsVisible ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 flex flex-col gap-4">
          {aiPresets.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {aiPresets.map(preset => (
                      <button
                          key={preset.name}
                          onClick={() => handlePresetClick(preset.prompt)}
                          disabled={isLoading}
                          className={`w-full text-center bg-purple-600/20 border border-transparent text-purple-300 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-purple-600/40 hover:border-purple-500 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresetPrompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-purple-500' : ''}`}
                      >
                          {preset.name}
                      </button>
                  ))}
              </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {presets.map(preset => (
              <button
                key={preset.name}
                onClick={() => handlePresetClick(preset.prompt)}
                disabled={isLoading}
                className={`w-full text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-3 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed ${selectedPresetPrompt === preset.prompt ? 'ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : ''}`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="relative -mt-2">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-700/50"></div>
        </div>
        <div className="relative flex justify-center">
            <span className="bg-gray-800/50 px-2 text-sm text-gray-400">或</span>
        </div>
      </div>

      <input
        type="text"
        value={customPrompt}
        onChange={handleCustomChange}
        placeholder="描述一个自定义纹理（例如，“生锈的金属板效果”）"
        className="flex-grow bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60 text-base"
        disabled={isLoading}
      />
      
      {activePrompt && (
        <div className="animate-fade-in flex gap-3">
          <BatchSelector count={batchCount} onChange={setBatchCount} disabled={isLoading} max={4} />
          <button
            onClick={handleApply}
            className="flex-1 bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
            disabled={isLoading || !activePrompt.trim()}
          >
            应用纹理
          </button>
        </div>
      )}
    </div>
  );
};

export default TexturePanel;
