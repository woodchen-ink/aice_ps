
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage, generateFusedImage, generateTexturedImage, removeBackgroundImage } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import FusionPanel from './components/FusionPanel';
import TexturePanel from './components/TexturePanel';
import ErasePanel from './components/ErasePanel';
import { UndoIcon, RedoIcon, EyeIcon, BullseyeIcon, DownloadIcon, RefreshIcon, NewFileIcon, UploadIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import PastForwardPage from './components/PastForwardPage';
import TemplateLibraryPage from './components/TemplateLibraryPage';
import TemplateDisplayPage from './components/TemplateDisplayPage';
import BatchResultModal from './components/BatchResultModal';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

// Helper for cropping
function getCroppedImg(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  fileName: string,
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return Promise.reject(new Error('Failed to get canvas context'));
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      resolve(new File([blob], fileName, { type: 'image/png' }));
    }, 'image/png');
  });
}

const MAX_FILE_SIZE_MB = 12;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type Tab = 'retouch' | 'adjust' | 'filters' | 'crop' | 'fusion' | 'texture' | 'erase';

const tabNames: Record<Tab, string> = {
  adjust: '调整',
  filters: '滤镜',
  texture: '纹理',
  erase: '抠图',
  crop: '裁剪',
  fusion: '合成',
  retouch: '修饰',
};

const TABS: Tab[] = ['adjust', 'filters', 'texture', 'erase', 'crop', 'fusion', 'retouch'];

type LastAction = 
  | { type: 'retouch', prompt: string, hotspot: { x: number, y: number } }
  | { type: 'adjust', prompt: string }
  | { type: 'filters', prompt: string }
  | { type: 'fusion', prompt: string, sourceImages: File[] }
  | { type: 'texture', prompt: string }
  | { type: 'erase' };

export type View = 'editor' | 'past-forward' | 'template-library' | 'template-display';
export type EditorInitialState = { baseImageFile: File; prompt: string };
export interface Template {
  id: string;
  name: string;
  iconUrl: string;
  baseUrl: string;
  description: string;
  prompt: string;
}


const EditorView: React.FC<{
    onFileSelect: (files: FileList | null) => void;
    onImageGenerated: (dataUrl: string) => void;
    initialState?: EditorInitialState | null;
    onTemplateLoaded: () => void;
    onTemplateSelect: (template: Template) => void;
    onShowTemplateLibrary: () => void;
}> = ({ onFileSelect, onImageGenerated, initialState, onTemplateLoaded, onTemplateSelect, onShowTemplateLibrary }) => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTemplateLoading, setIsTemplateLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('adjust');
  const [isComparing, setIsComparing] = useState(false);
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const [initialAdjustPrompt, setInitialAdjustPrompt] = useState<string | undefined>();

  // Batch Processing State
  const [batchCandidates, setBatchCandidates] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Ref to track if we're currently processing a template to prevent duplicate loads
  const isProcessingTemplateRef = useRef<boolean>(false);
  const hasLoadedFromUrlRef = useRef<boolean>(false);

  // Cropping state
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();

  // Retouch state
  const [retouchPrompt, setRetouchPrompt] = useState('');
  const [retouchHotspot, setRetouchHotspot] = useState<{ x: number, y: number } | null>(null);

  // File input ref for replacing image
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);

  const currentImageFile = history[historyIndex];
  const originalImageFile = history[0];

  useEffect(() => {
    if (currentImageFile) {
        const url = URL.createObjectURL(currentImageFile);
        setImageSrc(url);
        return () => URL.revokeObjectURL(url);
    }
    setImageSrc(null);
  }, [currentImageFile]);
  
  useEffect(() => {
    if (originalImageFile) {
        const url = URL.createObjectURL(originalImageFile);
        setOriginalImageSrc(url);
        return () => URL.revokeObjectURL(url);
    }
    setOriginalImageSrc(null);
  }, [originalImageFile]);

  // Effect to load template from URL parameter
  useEffect(() => {
    // Only run once on mount
    if (hasLoadedFromUrlRef.current) {
        return;
    }

    const urlParams = new URLSearchParams(window.location.hash.substring(2)); // Skip '#?'
    const templateId = urlParams.get('templateId');

    if (!templateId) {
        return;
    }

    hasLoadedFromUrlRef.current = true;
    isProcessingTemplateRef.current = true;
    setIsTemplateLoading(true);

    const loadTemplateFromId = async () => {
        try {
            // Fetch templates.json
            const response = await fetch('./templates.json');
            if (!response.ok) {
                throw new Error('无法加载模板列表');
            }
            const templates: Template[] = await response.json();
            const template = templates.find(t => t.id === templateId);

            if (!template) {
                throw new Error(`找不到模板: ${templateId}`);
            }

            // Fetch the template image
            const imageResponse = await fetch(template.baseUrl);
            if (!imageResponse.ok) {
                throw new Error('无法加载模板图片');
            }
            const blob = await imageResponse.blob();
            const fileName = template.baseUrl.split('/').pop() || 'template.png';
            const file = new File([blob], fileName, { type: blob.type });

            // Set the editor state
            setHistory([file]);
            setHistoryIndex(0);
            setActiveTab('adjust');
            setInitialAdjustPrompt(template.prompt);
            setIsTemplateLoading(false);
            isProcessingTemplateRef.current = false;

            // Clear the URL parameter
            window.location.hash = '#';
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : '加载模板时出错';
            console.error('Error loading template from URL:', errorMessage, e);
            setError(errorMessage);
            setIsTemplateLoading(false);
            isProcessingTemplateRef.current = false;
            hasLoadedFromUrlRef.current = false; // Allow retry
        }
    };

    loadTemplateFromId();
  }, []); // Empty deps - only run on mount

  // Effect to load a template's initial state (legacy, keeping for compatibility)
  useEffect(() => {
    if (!initialState) {
        return;
    }

    // Prevent duplicate processing (React Strict Mode calls effects twice)
    if (isProcessingTemplateRef.current) {
        return;
    }

    isProcessingTemplateRef.current = true;
    setIsTemplateLoading(true);

    // Directly use the provided file - no async fetch needed
    setHistory([initialState.baseImageFile]);
    setHistoryIndex(0);
    setActiveTab('adjust');
    setInitialAdjustPrompt(initialState.prompt);

    // Clean up after a brief delay to show the state transition
    setTimeout(() => {
        setIsTemplateLoading(false);
        onTemplateLoaded();
        isProcessingTemplateRef.current = false;
    }, 100);
  }, [initialState, onTemplateLoaded]);


  const displaySrc = isComparing ? originalImageSrc : imageSrc;

  const updateHistory = (newFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset any single-use state
    setCrop(undefined);
    setCompletedCrop(undefined);
    setRetouchHotspot(null);
  };
  
  const handleLocalFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`图片文件大小不能超过 ${MAX_FILE_SIZE_MB}MB。请选择一个较小的文件。`);
        return;
      }
      setHistory([file]);
      setHistoryIndex(0);
      setActiveTab('adjust');
      setError(null);
      setLastAction(null);
      onFileSelect(files);
    }
  };

  const handleLocalImageGenerated = (dataUrl: string) => {
    setIsLoading(true); // show spinner while converting
    try {
        const newFile = dataURLtoFile(dataUrl, `generated-${Date.now()}.png`);
        setHistory([newFile]);
        setHistoryIndex(0);
        setActiveTab('adjust'); // or another default
        setError(null);
        setLastAction(null);
        onImageGenerated(dataUrl);
    } catch(e) {
        console.error("Failed to process generated image", e);
        setError(e instanceof Error ? e.message : '处理生成图像时出错');
    } finally {
        setIsLoading(false);
    }
  }
  
  const handleBatchSelection = (imageUrl: string) => {
    handleLocalImageGenerated(imageUrl);
    setIsBatchModalOpen(false);
    setBatchCandidates([]);
  };

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, history.length]);

  const handleStartOver = useCallback(() => {
    setHistory([]);
    setHistoryIndex(-1);
    setLastAction(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setRetouchHotspot(null);
    setRetouchPrompt('');
  }, []);
  
  const handleSaveImage = useCallback(() => {
    if (currentImageFile) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(currentImageFile);
        const originalName = currentImageFile.name.substring(0, currentImageFile.name.lastIndexOf('.')) || 'image';
        link.download = `${originalName}-edited.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }
  }, [currentImageFile]);

  const handleReplaceImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      updateHistory(file);
      setLastAction(null);
      // Reset file input so the same file can be selected again
      e.target.value = '';
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isLoading || !currentImageFile) return;

        if (e.ctrlKey || e.metaKey) { // Meta for Mac
            if (e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if (e.key === 'y') {
                e.preventDefault();
                handleRedo();
            } else if (e.key === 's') {
                e.preventDefault();
                handleSaveImage();
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoading, currentImageFile, handleUndo, handleRedo, handleSaveImage]);

  // Run task N times
  const runGenerativeTask = async (task: () => Promise<string>, count: number = 1) => {
    setIsLoading(true);
    setError(null);
    setRetouchHotspot(null);
    try {
      if (count === 1) {
        const resultDataUrl = await task();
        const newFile = dataURLtoFile(resultDataUrl, `edit-${Date.now()}.png`);
        updateHistory(newFile);
      } else {
        // Run in parallel for batch
        const tasks = Array.from({ length: count }, () => task());
        const results = await Promise.all(tasks);
        setBatchCandidates(results);
        setIsBatchModalOpen(true);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '发生了未知错误');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleApplyFilter = (prompt: string, count: number = 1) => {
    setLastAction({ type: 'filters', prompt });
    runGenerativeTask(() => generateFilteredImage(currentImageFile, prompt), count);
  };
  
  const handleApplyAdjustment = (prompt: string, count: number = 1) => {
    setLastAction({ type: 'adjust', prompt });
    runGenerativeTask(() => generateAdjustedImage(currentImageFile, prompt), count);
  };
  
  const handleApplyFusion = (sourceImages: File[], prompt: string, count: number = 1) => {
    setLastAction({ type: 'fusion', prompt, sourceImages });
    runGenerativeTask(() => generateFusedImage(currentImageFile, sourceImages, prompt), count);
  };

  const handleApplyTexture = (prompt: string, count: number = 1) => {
    setLastAction({ type: 'texture', prompt });
    runGenerativeTask(() => generateTexturedImage(currentImageFile, prompt), count);
  };

  const handleRemoveBackground = () => {
    setLastAction({ type: 'erase' });
    runGenerativeTask(() => removeBackgroundImage(currentImageFile), 1);
  };

  const handleApplyCrop = async () => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
        setIsLoading(true);
        setError(null);
        try {
            const croppedImageFile = await getCroppedImg(
                imgRef.current,
                completedCrop,
                `crop-${Date.now()}.png`
            );
            updateHistory(croppedImageFile);
            setLastAction(null); // Crop is not a generative action we can re-run
        } catch(e) {
            console.error("Cropping failed", e);
            setError(e instanceof Error ? e.message : '裁剪图片时出错');
        } finally {
            setIsLoading(false);
        }
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch' || !imgRef.current) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = imgRef.current.naturalWidth / rect.width;
    const scaleY = imgRef.current.naturalHeight / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    setRetouchHotspot({ x, y });
  };

  const handleApplyRetouch = () => {
    if (retouchPrompt && retouchHotspot) {
      setLastAction({ type: 'retouch', prompt: retouchPrompt, hotspot: retouchHotspot });
      // Retouch is usually specific, keep it single for now unless requested
      runGenerativeTask(() => generateEditedImage(currentImageFile, retouchPrompt, retouchHotspot!), 1);
      setRetouchPrompt('');
    }
  };

  const handleRegenerate = useCallback(() => {
    if (!lastAction || historyIndex < 1 || isLoading) return;

    // The image state *before* the last action was applied
    const imageToEdit = history[historyIndex - 1];

    let task: (() => Promise<string>) | null = null;
    switch (lastAction.type) {
      case 'retouch':
        task = () => generateEditedImage(imageToEdit, lastAction.prompt, lastAction.hotspot);
        break;
      case 'adjust':
        task = () => generateAdjustedImage(imageToEdit, lastAction.prompt);
        break;
      case 'filters':
        task = () => generateFilteredImage(imageToEdit, lastAction.prompt);
        break;
      case 'texture':
        task = () => generateTexturedImage(imageToEdit, lastAction.prompt);
        break;
      case 'erase':
        task = () => removeBackgroundImage(imageToEdit);
        break;
      case 'fusion':
        task = () => generateFusedImage(imageToEdit, lastAction.sourceImages, lastAction.prompt);
        break;
    }

    if (task) {
      // Set the history index back by one. The `runGenerativeTask` will then
      // overwrite the last state with the new regenerated one.
      setHistoryIndex(historyIndex - 1);
      runGenerativeTask(task, 1); // Regenerate is always single for now
    }
  }, [lastAction, history, historyIndex, isLoading]);
  
  const ActionButton = ({ onClick, disabled, icon: Icon, label, title }: any) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="p-3 glass-button rounded-xl text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed group relative"
        aria-label={label}
        title={title}
    >
        <Icon className="w-6 h-6" />
    </button>
  );

  const ActionButtons = () => (
    <>
      <ActionButton onClick={handleReplaceImage} disabled={isLoading} icon={UploadIcon} label="更换图片" title="更换图片" />
      <ActionButton onClick={handleStartOver} disabled={isLoading} icon={NewFileIcon} label="新图片" title="新图片" />
      <ActionButton onClick={handleUndo} disabled={historyIndex <= 0 || isLoading} icon={UndoIcon} label="撤销" title="撤销 (Ctrl+Z)" />
      <ActionButton onClick={handleRedo} disabled={historyIndex >= history.length - 1 || isLoading} icon={RedoIcon} label="重做" title="重做 (Ctrl+Y)" />
      <ActionButton onClick={handleRegenerate} disabled={!lastAction || historyIndex < 1 || isLoading} icon={RefreshIcon} label="重新生成" title="重新生成" />
      <button
        onMouseDown={() => setIsComparing(true)}
        onMouseUp={() => setIsComparing(false)}
        onMouseLeave={() => setIsComparing(false)}
        onTouchStart={() => setIsComparing(true)}
        onTouchEnd={() => setIsComparing(false)}
        disabled={isLoading || history.length < 2}
        className="p-3 glass-button rounded-xl text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed group"
        aria-label="按住对比原图"
        title="按住对比原图"
      >
        <EyeIcon className="w-6 h-6" />
      </button>
      <ActionButton onClick={handleSaveImage} disabled={isLoading || !currentImageFile} icon={DownloadIcon} label="保存图片" title="保存图片 (Ctrl+S)" />
    </>
  );

  if (isTemplateLoading) {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 animate-fade-in min-h-[60vh]">
            <Spinner className="h-16 w-16 text-blue-400" />
            <p className="mt-4 text-lg text-gray-300 font-semibold">正在加载模板...</p>
        </div>
    );
  }

  return (
    <>
      {/* Hidden file input for replacing image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
      {error && !currentImageFile && !isTemplateLoading && (
        <div className="w-full max-w-4xl mx-auto bg-red-500/20 border border-red-500/50 text-red-200 px-6 py-4 rounded-xl relative text-center mb-4 animate-fade-in backdrop-blur-sm shadow-lg" role="alert">
          <strong className="font-bold">错误：</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}
      {!currentImageFile && !isTemplateLoading ? (
        <StartScreen
            onFileSelect={handleLocalFileSelect}
            onImageGenerated={handleLocalImageGenerated}
            onTemplateSelect={onTemplateSelect}
            onShowTemplateLibrary={onShowTemplateLibrary}
        />
      ) : isTemplateLoading ? (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <Spinner className="h-16 w-16 text-blue-400" />
          <p className="mt-4 text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-bold animate-pulse">正在加载模板...</p>
        </div>
      ) : currentImageFile ? (
        <div className="w-full h-full flex flex-col animate-fade-in overflow-hidden">
          {error && (
            <div className="w-full bg-red-500/20 border-b border-red-500/50 text-red-200 px-6 py-3 text-center animate-fade-in backdrop-blur-sm" role="alert">
              <strong className="font-bold">错误：</strong>
              <span className="ml-2">{error}</span>
            </div>
           )}

          {/* Main Editor Area */}
          <div className="flex-1 flex overflow-hidden">

              {/* Image Canvas */}
              <div className="flex-1 flex items-center justify-center p-6 overflow-auto relative">
                <div className="bg-[#0a0b10] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden border border-white/5 relative group min-h-[500px] w-full max-w-5xl">
                    {isLoading && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20 backdrop-blur-md">
                        <Spinner className="h-16 w-16 text-blue-400" />
                        <p className="mt-4 text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-bold animate-pulse">AI 正在创作中...</p>
                      </div>
                    )}

                    {displaySrc ? (
                      <div className="relative min-h-[500px] flex items-center justify-center">
                        <ReactCrop
                          crop={crop}
                          onChange={c => setCrop(c)}
                          onComplete={c => setCompletedCrop(c)}
                          aspect={aspect}
                          disabled={isLoading || activeTab !== 'crop'}
                          ruleOfThirds
                          className="max-h-[75vh] flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDBoMTB2MTBIMTB6TTAgMTBoMTB2MTBIMHoiIGZpbGw9IiMxMTEyMTYiIGZpbGwtb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]"
                        >
                          <img
                            ref={imgRef}
                            src={displaySrc}
                            alt="用户上传的内容"
                            className={`max-w-full max-h-[75vh] w-auto h-auto mx-auto block transition-all duration-300 ${isComparing ? 'opacity-80 blur-[0.5px]' : ''}`}
                            onClick={handleImageClick}
                            style={{ cursor: activeTab === 'retouch' ? 'crosshair' : 'default' }}
                          />
                        </ReactCrop>
                        {retouchHotspot && !isLoading && activeTab === 'retouch' && (
                            <div
                                className="absolute z-10 pointer-events-none"
                                style={{
                                    left: `calc(${(retouchHotspot.x / (imgRef.current?.naturalWidth ?? 1)) * 100}% - 12px)`,
                                    top: `calc(${(retouchHotspot.y / (imgRef.current?.naturalHeight ?? 1)) * 100}% - 12px)`,
                                }}
                            >
                                <div className="relative">
                                    <BullseyeIcon className="w-6 h-6 text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]" />
                                    <div className="absolute inset-0 rounded-full animate-ping bg-blue-400/50"></div>
                                </div>
                            </div>
                        )}
                      </div>
                    ) : !isLoading && <div className="h-[65vh] flex items-center justify-center bg-gray-900"><Spinner/></div>}
                    
                    {isComparing && (
                        <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md border border-white/10 text-white px-3 py-1 rounded-lg text-sm font-semibold z-10 shadow-lg">
                            正在对比原图
                        </div>
                    )}
                </div>

                {/* Floating Action Bar for Desktop */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 hidden lg:flex z-10">
                   <ActionButtons />
                </div>
                 {/* Action Bar for Mobile */}
                <div className="flex lg:hidden justify-center items-center gap-2 mt-4 overflow-x-auto pb-2">
                    <ActionButtons />
                </div>
              </div>

              {/* Controls Panel - Right Sidebar */}
              <div className="w-96 flex-shrink-0 flex flex-col gap-4 border-l border-white/5 bg-gray-900/30 p-6 overflow-y-auto">
                  {/* Segmented Control Tabs */}
                <div className="glass-panel p-1.5 rounded-xl grid grid-cols-4 gap-1">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { if (!isLoading) { setActiveTab(tab); setRetouchHotspot(null); } }}
                      className={`py-2.5 px-2 text-xs font-medium rounded-lg transition-all duration-200 focus:outline-none whitespace-nowrap ${
                        activeTab === tab
                          ? 'bg-white/10 text-white shadow-sm shadow-black/20 backdrop-blur-sm'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                      disabled={isLoading}
                    >
                      {tabNames[tab]}
                    </button>
                  ))}
                </div>

                <div className="w-full">
                  {activeTab === 'retouch' && (
                      <div className="glass-panel rounded-xl p-5 flex flex-col gap-4 animate-fade-in">
                          <div className="flex items-center gap-2 text-gray-300">
                              <BullseyeIcon className="w-5 h-5 text-blue-400" />
                              <h3 className="font-semibold">智能修饰</h3>
                          </div>
                          <p className="text-xs text-gray-400">1. 点击图片上的区域<br/>2. 描述修改内容</p>
                          <div className="space-y-3">
                             <input
                                  type="text"
                                  value={retouchPrompt}
                                  onChange={(e) => setRetouchPrompt(e.target.value)}
                                  placeholder="例如：“移除这个”或“改成红色”"
                                  className="input-modern w-full text-sm"
                                  disabled={isLoading}
                              />
                              <button
                                  onClick={handleApplyRetouch}
                                  className="w-full btn-primary py-3 rounded-xl text-sm"
                                  disabled={isLoading || !retouchPrompt.trim() || !retouchHotspot}
                              >
                                  应用
                              </button>
                          </div>
                      </div>
                  )}
                  {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} currentImage={currentImageFile} onError={setError} initialPrompt={initialAdjustPrompt} />}
                  {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} currentImage={currentImageFile} onError={setError} />}
                  {activeTab === 'texture' && <TexturePanel onApplyTexture={handleApplyTexture} isLoading={isLoading} currentImage={currentImageFile} onError={setError} />}
                  {activeTab === 'erase' && <ErasePanel onRemoveBackground={handleRemoveBackground} isLoading={isLoading} />}
                  {activeTab === 'crop' && (
                    <CropPanel
                      onApplyCrop={handleApplyCrop}
                      onSetAspect={setAspect}
                      isLoading={isLoading}
                      isCropping={!!completedCrop?.width && !!completedCrop?.height}
                    />
                  )}
                  {activeTab === 'fusion' && <FusionPanel onApplyFusion={handleApplyFusion} isLoading={isLoading} onError={setError} />}
                </div>
              </div>
          </div>
        </div>
      ) : null}
      <BatchResultModal
        isOpen={isBatchModalOpen}
        images={batchCandidates}
        onSelect={handleBatchSelection}
        onClose={() => setIsBatchModalOpen(false)}
      />
    </>
  );
}


const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('editor');
  const [notification, setNotification] = useState<string | null>(null);
  const [editorInitialState, setEditorInitialState] = useState<EditorInitialState | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Load settings from URL parameters on app mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlKey = urlParams.get('key');
    const urlServer = urlParams.get('server');

    if (urlKey || urlServer) {
      if (urlKey) {
        console.log('Importing API key from URL:', urlKey);
        localStorage.setItem('gemini-api-key', urlKey);
      }
      if (urlServer) {
        console.log('Importing server URL from URL:', urlServer);
        localStorage.setItem('gemini-base-url', urlServer);
      }

      // Clean up URL parameters after importing
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);

      console.log('Settings imported successfully. Saved values:', {
        key: localStorage.getItem('gemini-api-key'),
        server: localStorage.getItem('gemini-base-url')
      });
    }
  }, []);

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setActiveView('template-display');
  };
  
  const handleShowTemplateLibrary = () => {
    setActiveView('template-library');
  };

  const handleTemplateLoaded = useCallback(() => {
    setEditorInitialState(null);
  }, []);

  const handleUseTemplateInEditor = (templateId: string) => {
    // Navigate to editor with templateId as URL parameter
    window.location.hash = `#?templateId=${encodeURIComponent(templateId)}`;
    setSelectedTemplate(null);
    setActiveView('editor');
  };
  
  // Dummy handlers to satisfy the EditorView props
  const handleFileSelect = () => {};
  const handleImageGenerated = () => {};

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [notification]);
  
  const MainContent: React.FC = () => {
    // Always render EditorView to preserve its state, but hide it when not active
    return (
      <>
        <div style={{ display: activeView === 'editor' ? 'contents' : 'none' }}>
          <EditorView
              onFileSelect={handleFileSelect}
              onImageGenerated={handleImageGenerated}
              initialState={editorInitialState}
              onTemplateLoaded={handleTemplateLoaded}
              onTemplateSelect={handleTemplateSelect}
              onShowTemplateLibrary={handleShowTemplateLibrary}
          />
        </div>
        {activeView === 'past-forward' && (
          <div className="w-full h-full overflow-y-auto">
            <PastForwardPage />
          </div>
        )}
        {activeView === 'template-library' && (
          <div className="w-full h-full overflow-y-auto">
            <TemplateLibraryPage onTemplateSelect={handleTemplateSelect} />
          </div>
        )}
        {activeView === 'template-display' && selectedTemplate && (
          <div className="w-full h-full overflow-y-auto">
            <TemplateDisplayPage
                template={selectedTemplate}
                onBack={() => {
                    setSelectedTemplate(null);
                    setActiveView('template-library');
                }}
                onUseInEditor={handleUseTemplateInEditor}
            />
          </div>
        )}
      </>
    );
  };


  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans text-gray-100 selection:bg-blue-500/30 selection:text-blue-100">
      <Header
        activeView={activeView}
        onViewChange={(view) => {
            if (view !== 'editor' && view !== 'template-display') {
                setEditorInitialState(null);
                setSelectedTemplate(null);
            }
            setActiveView(view)
        }}
      />
      <main className="flex-1 flex overflow-hidden relative z-10">
        <MainContent />
      </main>
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="fixed bottom-6 right-6 z-50 bg-green-500/90 text-white px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md border border-green-400/30 flex items-center gap-3"
          >
             <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <p className="font-semibold">{notification}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
