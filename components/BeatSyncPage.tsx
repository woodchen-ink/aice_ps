/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateStyledImage } from '../services/geminiService';
import { UploadIcon, DownloadIcon, ChevronDownIcon, PlayIcon, PauseIcon, RefreshIcon } from './icons';
import Spinner from './Spinner';

type AppState = 'idle' | 'generating-images' | 'generating-video' | 'results-shown' | 'error';
type ImageStatus = 'pending' | 'done' | 'error';
type GeneratedImage = {
    status: ImageStatus;
    url?: string;
    error?: string;
};
type TransitionStyle = 'ken-burns' | 'shake' | 'flash' | 'slide';

const DEFAULT_PROMPTS = {
    6: [
        "复古宝丽来照片，色彩褪色，有漏光效果。",
        "充满活力的日本动漫风格，有大胆的轮廓和赛璐珞着色。",
        "高对比度、戏剧性的黑白电影黑色美学。",
        "80年代合成波美学，带有霓虹品红和青色光晕，以及微妙的扫描线。",
        "印象派油画，笔触可见且厚重。",
        "未来主义赛博朋к场景，有发光的霓虹灯和雨中反光的街道。"
    ],
    8: [
        "复古宝丽来照片，色彩褪色，有漏光效果。",
        "充满活力的日本动漫风格，有大胆的轮廓和赛璐珞着色。",
        "高对比度、戏剧性的黑白电影黑色美学。",
        "80年代合成波美学，带有霓虹品红和青色光晕，以及微妙的扫描线。",
        "印象派油画，笔触可见且厚重。",
        "未来主义赛博朋克场景，有发光的霓虹灯和雨中反光的街道。",
        "双重曝光效果，将主体与森林景观融合。",
        "受萨尔瓦多·达利启发的超现实主义，带有梦幻般的元素。"
    ],
    10: [
        "复古宝丽来照片，色彩褪色，有漏光效果。",
        "充满活力的日本动漫风格，有大胆的轮廓和赛璐珞着色。",
        "高对比度、戏剧性的黑白电影黑色美学。",
        "80年代合成波美学，带有霓虹品红和青色光晕，以及微妙的扫描线。",
        "印象派油画，笔触可见且厚重。",
        "未来主义赛博朋к场景，有发光的霓虹灯和雨中反光的街道。",
        "双重曝光效果，将主体与森林景观融合。",
        "受萨尔瓦多·达利启发的超现实主义，带有梦幻般的元素。",
        "装饰艺术海报风格，带有几何形状和金色点缀。",
        "Lomography风格的交叉处理胶片效果，具有高对比度、过饱和的色彩和暗角。"
    ],
};

const MUSIC_TRACKS = [
    { name: "活力电音", url: "https://huggingface.co/spaces/aigenai/noconb/resolve/main/Rock-Guitar-Power.mp3" },
];

// Helper to add retry logic to image generation
const generateWithRetry = async (file: File, prompt: string, retries = 1): Promise<string> => {
    try {
        return await generateStyledImage(file, prompt);
    } catch (error) {
        if (retries > 0) {
            console.warn(`Image generation failed, retrying... (${retries} attempts left)`);
            await new Promise(res => setTimeout(res, 1000)); // Wait 1 second before retrying
            return generateWithRetry(file, prompt, retries - 1);
        }
        throw error;
    }
};

// Helper for random numbers
const rand = (min: number, max: number) => Math.random() * (max - min) + min;

const BeatSyncPage: React.FC = () => {
    const [appState, setAppState] = useState<AppState>('idle');
    const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
    const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
    const [imageCount, setImageCount] = useState<6 | 8 | 10>(6);
    const [stylePrompts, setStylePrompts] = useState<string[]>(DEFAULT_PROMPTS[6]);
    const [selectedMusicUrl, setSelectedMusicUrl] = useState<string>(MUSIC_TRACKS[0].url);
    const [customMusicUrl, setCustomMusicUrl] = useState<string | null>(null);
    const [customMusicName, setCustomMusicName] = useState<string | null>(null);
    const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>('ken-burns');
    const [generatedImages, setGeneratedImages] = useState<Record<number, GeneratedImage>>({});
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [activeAccordion, setActiveAccordion] = useState<number | null>(null);
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playingMusic, setPlayingMusic] = useState<string | null>(null);
    
    useEffect(() => {
        setStylePrompts(DEFAULT_PROMPTS[imageCount]);
    }, [imageCount]);
    
    // Cleanup custom music object URL
    useEffect(() => {
        return () => {
            if (customMusicUrl) {
                URL.revokeObjectURL(customMusicUrl);
            }
        };
    }, [customMusicUrl]);

    // Cleanup uploaded image preview URL
    useEffect(() => {
        if (!uploadedImageFile) {
            setUploadedImagePreview(null);
            return;
        }
        const objectUrl = URL.createObjectURL(uploadedImageFile);
        setUploadedImagePreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [uploadedImageFile]);
    
    // Cleanup generated video URL
    useEffect(() => {
        return () => {
            if (videoUrl) {
                URL.revokeObjectURL(videoUrl);
            }
        };
    }, [videoUrl]);

    // Auto-dismissing notification
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000); // 5 seconds
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const handleFileChange = (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('请上传有效的图片文件（PNG、JPEG等）。');
            return;
        }
        setError(null);
        setUploadedImageFile(file);
        setAppState('idle'); // Reset state if a new image is uploaded
        setGeneratedImages({});
        setVideoUrl(null);
    };

    const handleMusicFileChange = (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            setError('请上传有效的音频文件 (MP3, WAV, etc.)。');
            return;
        }
        setError(null);

        // Revoke previous custom URL if it exists to prevent memory leaks
        if (customMusicUrl) {
            URL.revokeObjectURL(customMusicUrl);
        }

        const newUrl = URL.createObjectURL(file);
        setCustomMusicUrl(newUrl);
        setCustomMusicName(file.name);
        setSelectedMusicUrl(newUrl);
    };

    const handleGenerate = async () => {
        if (!uploadedImageFile) {
            setError("请先上传一张图片。");
            return;
        }
        setAppState('generating-images');
        setError(null);
        setNotification(null);
        setVideoUrl(null);

        const initialImages: Record<number, GeneratedImage> = {};
        for(let i = 0; i < imageCount; i++) {
            initialImages[i] = { status: 'pending' };
        }
        setGeneratedImages(initialImages);

        // Concurrency limiting for image generation
        const concurrencyLimit = 3;
        const promptsQueue = [...stylePrompts.entries()]; // [index, prompt]

        const processQueue = async () => {
            if (promptsQueue.length === 0) return;

            const [index, prompt] = promptsQueue.shift()!;
            
            try {
                const url = await generateWithRetry(uploadedImageFile!, prompt);
                setGeneratedImages(prev => ({ ...prev, [index]: { status: 'done', url } }));
            } catch (err) {
                console.error(`Failed to generate image for style ${index + 1}:`, err);
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                setGeneratedImages(prev => ({ ...prev, [index]: { status: 'error', error: errorMessage } }));
            }
        };

        const workers = Array(concurrencyLimit).fill(null).map(async () => {
            while (promptsQueue.length > 0) {
                await processQueue();
            }
        });

        await Promise.all(workers);
    };

    const createVideo = useCallback(async (imageUrls: string[]) => {
        setAppState('generating-video');
        
        if (!imageUrls || imageUrls.length === 0) {
            setError("没有成功生成的图片来创建视频。");
            setAppState('error');
            return;
        }

        let timeoutId: number | null = null;
        let animationFrameId: number | null = null;
        let recorder: MediaRecorder | null = null;
        const audio = new Audio(selectedMusicUrl);

        try {
            // 1. Load images first to determine dimensions
            const images = await Promise.all(imageUrls.map(url => {
                return new Promise<HTMLImageElement>((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => resolve(img);
                    img.onerror = () => {
                        console.error(`Failed to load image: ${url}`);
                        resolve(img); // Still resolve, will be filtered by width/height check
                    };
                    img.src = url;
                });
            })).then(imgs => imgs.filter(img => img.width > 0 && img.height > 0));
            
            if (images.length === 0) {
                throw new Error(`所有生成的图像都无法加载。`);
            }
            
            // 2. Setup canvas with dynamic size
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("无法创建画布上下文。");
    
            const firstImage = images[0];
            const MAX_DIMENSION = 1280;
            let videoWidth = firstImage.naturalWidth;
            let videoHeight = firstImage.naturalHeight;
    
            if (videoWidth > MAX_DIMENSION || videoHeight > MAX_DIMENSION) {
                const aspectRatio = videoWidth / videoHeight;
                if (videoWidth >= videoHeight) {
                    videoWidth = MAX_DIMENSION;
                    videoHeight = Math.round(videoWidth / aspectRatio);
                } else {
                    videoHeight = MAX_DIMENSION;
                    videoWidth = Math.round(videoHeight * aspectRatio);
                }
            }
            
            // Ensure dimensions are even for better video encoding compatibility
            canvas.width = videoWidth - (videoWidth % 2);
            canvas.height = videoHeight - (videoHeight % 2);

            // 3. Load audio and setup streams
            audio.crossOrigin = "anonymous";
            await new Promise((resolve, reject) => { 
                audio.oncanplaythrough = () => resolve(true);
                audio.onerror = () => reject(new Error("音频文件加载失败。请检查您的网络连接。"));
                audio.load();
            });
            
            const audioContext = new AudioContext();
            const source = audioContext.createMediaElementSource(audio);
            const dest = audioContext.createMediaStreamDestination();
            source.connect(dest);
            const audioTrack = dest.stream.getAudioTracks()[0];

            const videoStream = canvas.captureStream(30);
            const videoTrack = videoStream.getVideoTracks()[0];
            
            const combinedStream = new MediaStream([videoTrack, audioTrack]);
            recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });

            // 4. Setup recorder and start rendering
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                setVideoUrl(url);
                setAppState('results-shown');
                audio.remove();
            };

            const totalDuration = 10 * 1000; // 10 seconds
            const frameDuration = totalDuration / images.length;
            
            recorder.start();
            audio.play();

            timeoutId = window.setTimeout(() => {
                console.error("Video generation timed out.");
                if (recorder?.state === "recording") {
                    recorder.stop();
                    audio.pause();
                    setError("视频生成超时，已停止。请重试。");
                    setAppState('error');
                }
            }, 20000); // 20-second timeout
            
            let startTime = performance.now();
            
            const drawFrame = (currentTime: number) => {
                try {
                    const elapsedTime = currentTime - startTime;
                    if (elapsedTime >= totalDuration) {
                        if (recorder?.state === 'recording') recorder.stop();
                        return;
                    }
                    
                    const imageIndex = Math.min(Math.floor(elapsedTime / frameDuration), images.length - 1);
                    
                    if (imageIndex < 0) { // Safeguard
                        animationFrameId = requestAnimationFrame(drawFrame);
                        return;
                    }

                    const currentImage = images[imageIndex];

                    if (!currentImage || currentImage.width === 0) { // Safeguard
                        animationFrameId = requestAnimationFrame(drawFrame);
                        return;
                    }

                    const progressInFrame = (elapsedTime % frameDuration) / frameDuration;

                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Universal aspect ratio calculation to fill canvas
                    const imgAspectRatio = currentImage.width / currentImage.height;
                    const canvasAspectRatio = canvas.width / canvas.height;
                    let drawWidth, drawHeight;

                    if (imgAspectRatio > canvasAspectRatio) { // Image is wider than canvas
                        drawHeight = canvas.height;
                        drawWidth = drawHeight * imgAspectRatio;
                    } else { // Image is taller or same aspect ratio
                        drawWidth = canvas.width;
                        drawHeight = drawWidth / imgAspectRatio;
                    }

                    switch (transitionStyle) {
                        case 'slide': {
                            const slideDuration = 0.3; // Slide takes 30% of the frame time
                            const easedProgress = Math.min(progressInFrame / slideDuration, 1);
                            
                            // Use an easing function like easeOutCubic
                            const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
                            const slideProgress = easeOut(easedProgress);

                            const fromLeft = imageIndex % 2 === 0;
                            let xOffset = 0;

                            if (fromLeft) {
                                xOffset = -drawWidth + drawWidth * slideProgress;
                            } else {
                                xOffset = drawWidth - drawWidth * slideProgress;
                            }
                            
                            // Center the part of the image that is visible
                            const x = (canvas.width - drawWidth) / 2 + xOffset;
                            const y = (canvas.height - drawHeight) / 2;
                            ctx.drawImage(currentImage, x, y, drawWidth, drawHeight);
                            break;
                        }
                        case 'shake': {
                            const shakeThreshold = 0.8;
                            const shakeIntensity = 25;
                            const scale = 1.1 * (drawWidth / canvas.width); // Adjust scale based on fill
                            
                            ctx.save();
                            if (progressInFrame > shakeThreshold) {
                                const offsetX = rand(-shakeIntensity, shakeIntensity);
                                ctx.translate(offsetX, 0);
                            }
                            const x = (canvas.width - drawWidth * scale) / 2;
                            const y = (canvas.height - drawHeight * scale) / 2;
                            ctx.drawImage(currentImage, x, y, drawWidth * scale, drawHeight * scale);
                            ctx.restore();
                            break;
                        }
                        case 'flash': {
                            const flashThreshold = 0.15;
                            const scale = 1.1 * (drawWidth / canvas.width);
                            const x = (canvas.width - drawWidth * scale) / 2;
                            const y = (canvas.height - drawHeight * scale) / 2;
                            ctx.drawImage(currentImage, x, y, drawWidth * scale, drawHeight * scale);

                            if (progressInFrame < flashThreshold) {
                                const flashOpacity = 1 - (progressInFrame / flashThreshold);
                                ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                            }
                            break;
                        }
                        case 'ken-burns':
                        default: {
                            const scale = 1 + progressInFrame * 0.1;
                            const scaledWidth = drawWidth * scale;
                            const scaledHeight = drawHeight * scale;
                            const x = (canvas.width - scaledWidth) / 2;
                            const y = (canvas.height - scaledHeight) / 2;
                            ctx.drawImage(currentImage, x, y, scaledWidth, scaledHeight);
                            break;
                        }
                    }
                    
                    animationFrameId = requestAnimationFrame(drawFrame);
                } catch (e) {
                    console.error("Error during video frame rendering:", e);
                    setError(e instanceof Error ? e.message : "渲染视频时发生错误。");
                    setAppState('error');
                    if (recorder?.state === 'recording') recorder.stop();
                    audio.pause();
                }
            };

            animationFrameId = requestAnimationFrame(drawFrame);

        } catch (e) {
            console.error("Video creation failed:", e);
            setError(e instanceof Error ? e.message : "创建视频失败。");
            setAppState('error');
            if (recorder?.state === 'recording') recorder.stop();
            audio.pause();
        }
    }, [selectedMusicUrl, transitionStyle]);
    
    useEffect(() => {
        if (appState !== 'generating-images' || Object.values(generatedImages).length === 0) return;
        
        // FIX: Cast Object.values to the correct type to aid TypeScript inference.
        const allDone = Object.values(generatedImages).length === imageCount && 
                        (Object.values(generatedImages) as GeneratedImage[]).every(img => img.status !== 'pending');
        
        if (allDone) {
            // FIX: Cast Object.values to the correct type to aid TypeScript inference.
            const successfulImages = (Object.values(generatedImages) as GeneratedImage[]).filter(img => img.status === 'done' && img.url);
            if (successfulImages.length === 0) {
                setError("所有图片生成失败，请重试。");
                setAppState('error');
            } else {
                 if (successfulImages.length < imageCount) {
                     setNotification('部分图片生成失败，但我们将用成功的图片创建视频。');
                 }
                 // FIX: Correctly access the 'url' property on the typed 'img' object. The filter above ensures it's a string.
                 createVideo(successfulImages.map(img => img.url!));
            }
        }
    }, [generatedImages, appState, imageCount, createVideo]);

    const handleRegenerateVideo = useCallback(() => {
        // FIX: Cast Object.values to the correct type and map to url property.
        const successfulImages = (Object.values(generatedImages) as GeneratedImage[])
            .filter(img => img.status === 'done' && img.url)
            .map(img => img.url);
        
        if (successfulImages.length > 0) {
            createVideo(successfulImages);
        } else {
            setError("没有可用的图片来重新生成视频。");
            setAppState('error');
        }
    }, [generatedImages, createVideo]);

    const handleMusicPreview = async (url: string) => {
        if (!audioRef.current) return;

        if (playingMusic === url) {
            audioRef.current.pause();
            setPlayingMusic(null);
            return;
        }

        if (!audioRef.current.paused) {
            audioRef.current.pause();
        }

        audioRef.current.src = url;
        
        try {
            await audioRef.current.play();
            setPlayingMusic(url);
            setError(null);
        } catch (err: any) {
            console.error("Audio preview failed:", err);
            if (err.name !== 'AbortError') {
                setError("音频预览失败：无法加载或浏览器不支持该音频源。");
            }
            setPlayingMusic(null);
        }
    };
    
    const isGenerating = appState === 'generating-images' || appState === 'generating-video';
    // FIX: Cast Object.values to the correct type to aid TypeScript inference.
    const hasSuccessfulImages = (Object.values(generatedImages) as GeneratedImage[]).some(img => img.status === 'done');

    return (
        <div className="w-full max-w-7xl mx-auto p-4 md:p-8 relative">
            <div className="text-center mb-8">
                <h1 className="font-['Caveat'] text-5xl md:text-7xl font-bold text-white tracking-wider">音画志</h1>
                <p className="text-gray-300 text-lg md:text-xl mt-2">自定义风格化图集，随节拍一键成片。</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Left Column: Config */}
                <div className="w-full lg:w-1/3 flex-shrink-0">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-6 backdrop-blur-sm">
                        {/* Step 1 */}
                        <div>
                            <h3 className="text-xl font-bold text-white mb-3">1. 上传您的图片</h3>
                            <div className="h-48 w-full border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center bg-gray-900/50 cursor-pointer hover:border-blue-500 transition-colors" onClick={() => document.getElementById('beatsync-upload')?.click()}>
                                {uploadedImagePreview ? (
                                    <img src={uploadedImagePreview} alt="upload preview" className="max-h-full max-w-full object-contain"/>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <UploadIcon className="w-10 h-10 mx-auto" />
                                        <p className="mt-2 text-sm">点击或拖拽上传</p>
                                    </div>
                                )}
                            </div>
                            <input id="beatsync-upload" type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files)} />
                        </div>
                        
                        {/* Step 2 */}
                        <div>
                            <h3 className="text-xl font-bold text-white mb-3">2. 选择节拍</h3>
                             <div className="space-y-2">
                                {MUSIC_TRACKS.map(track => (
                                    <div key={track.name} className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${selectedMusicUrl === track.url ? 'bg-blue-600/30 ring-2 ring-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setSelectedMusicUrl(track.url)}>
                                        <button onClick={(e) => { e.stopPropagation(); handleMusicPreview(track.url);}} className="p-2 rounded-full bg-black/20 hover:bg-black/40 mr-3">
                                            {playingMusic === track.url ? <PauseIcon className="w-5 h-5 text-white" /> : <PlayIcon className="w-5 h-5 text-white" />}
                                        </button>
                                        <span className="font-semibold text-gray-200">{track.name}</span>
                                    </div>
                                ))}
                                {customMusicUrl && (
                                    <div className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${selectedMusicUrl === customMusicUrl ? 'bg-blue-600/30 ring-2 ring-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setSelectedMusicUrl(customMusicUrl)}>
                                        <button onClick={(e) => { e.stopPropagation(); handleMusicPreview(customMusicUrl);}} className="p-2 rounded-full bg-black/20 hover:bg-black/40 mr-3">
                                            {playingMusic === customMusicUrl ? <PauseIcon className="w-5 h-5 text-white" /> : <PlayIcon className="w-5 h-5 text-white" />}
                                        </button>
                                        <span className="font-semibold text-gray-200 truncate pr-2" title={customMusicName || 'Custom Music'}>{customMusicName || 'Custom Music'}</span>
                                    </div>
                                )}
                                <button onClick={() => document.getElementById('music-upload')?.click()} className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300">
                                    <UploadIcon className="w-5 h-5"/>
                                    <span>上传您自己的音乐</span>
                                </button>
                                <input id="music-upload" type="file" className="hidden" accept="audio/*" onChange={(e) => handleMusicFileChange(e.target.files)} />

                                <audio ref={audioRef} onEnded={() => setPlayingMusic(null)} crossOrigin="anonymous"/>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div>
                            <h3 className="text-xl font-bold text-white mb-3">3. 选择风格</h3>
                             <div className="flex gap-2 mb-4">
                                {[6, 8, 10].map(count => (
                                    <button key={count} onClick={() => setImageCount(count as 6 | 8 | 10)} disabled={isGenerating} className={`flex-1 py-2 rounded-md font-semibold transition-all ${imageCount === count ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                                        {count} 张图
                                    </button>
                                ))}
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {stylePrompts.map((prompt, index) => (
                                    <div key={index} className="bg-gray-700/50 rounded-lg">
                                        <button className="w-full flex justify-between items-center p-3 text-left" onClick={() => setActiveAccordion(activeAccordion === index ? null : index)}>
                                            <span className="font-semibold text-gray-200 truncate pr-2">风格 {index+1}：{prompt}</span>
                                            <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${activeAccordion === index ? 'rotate-180' : ''}`} />
                                        </button>
                                        {activeAccordion === index && (
                                            <div className="p-3 border-t border-gray-600">
                                                <textarea value={prompt} onChange={(e) => {
                                                    const newPrompts = [...stylePrompts];
                                                    newPrompts[index] = e.target.value;
                                                    setStylePrompts(newPrompts);
                                                }}
                                                disabled={isGenerating}
                                                className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition text-sm h-24 resize-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Step 4 */}
                        <div>
                            <h3 className="text-xl font-bold text-white mb-3">4. 选择过渡效果</h3>
                            <div className="relative">
                                <select
                                    value={transitionStyle}
                                    onChange={(e) => setTransitionStyle(e.target.value as TransitionStyle)}
                                    disabled={isGenerating}
                                    className="w-full appearance-none bg-gray-700 border border-gray-600 text-white py-3 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-gray-600 focus:border-gray-500"
                                >
                                    <option value="ken-burns">Ken Burns 缩放</option>
                                    <option value="shake">晃动切换</option>
                                    <option value="flash">闪光切换</option>
                                    <option value="slide">左右滑入</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                    <ChevronDownIcon className="w-5 h-5" />
                                </div>
                            </div>
                        </div>


                        <button onClick={handleGenerate} disabled={!uploadedImageFile || isGenerating} className="w-full py-4 text-lg font-bold text-white rounded-lg bg-gradient-to-br from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/50">
                            {isGenerating ? "生成中..." : "生成图片和视频"}
                        </button>
                    </div>
                </div>

                {/* Right Column: Display */}
                <div className="w-full lg:w-2/3 flex items-center justify-center bg-black/30 border border-gray-700 rounded-xl min-h-[60vh] p-4">
                    <AnimatePresence mode="wait">
                        {appState === 'idle' && (
                            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-gray-400">
                                <p className="text-2xl font-semibold">您的视频将在此处显示</p>
                                <p>请完成左侧步骤以开始</p>
                            </motion.div>
                        )}
                        {(appState === 'generating-images' || appState === 'generating-video') && (
                            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col items-center justify-center">
                                {appState === 'generating-video' ? (
                                    <div className="text-center">
                                        <Spinner className="w-16 h-16 text-blue-400" />
                                        <p className="text-xl font-semibold mt-4 text-gray-300">正在合成视频...</p>
                                        <p className="text-sm text-gray-400">这可能需要一点时间</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full">
                                        {Object.entries(generatedImages).map(([index, img]: [string, GeneratedImage]) => (
                                            <motion.div key={index} className="aspect-square bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: parseInt(index) * 0.1}}>
                                                {img.status === 'pending' && <Spinner className="w-8 h-8 text-gray-500"/>}
                                                {img.status === 'done' && img.url && <img src={img.url} className="w-full h-full object-cover"/>}
                                                {img.status === 'error' && <div className="text-center p-2 text-red-400 text-xs">失败</div>}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                         {appState === 'results-shown' && videoUrl && (
                            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-2xl text-center">
                                <video src={videoUrl} controls autoPlay loop className="w-full max-w-full max-h-[60vh] h-auto rounded-lg shadow-2xl shadow-black mb-4 bg-black"></video>
                                <div className="flex items-center justify-center gap-4">
                                    <a href={videoUrl} download="beatsync-video.webm" className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors">
                                        <DownloadIcon className="w-6 h-6"/>
                                        下载视频
                                    </a>
                                     <button onClick={handleRegenerateVideo} disabled={isGenerating || !hasSuccessfulImages} className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed">
                                        <RefreshIcon className="w-6 h-6"/>
                                        重新生成视频
                                    </button>
                                </div>
                            </motion.div>
                        )}
                        {appState === 'error' && error && (
                            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-red-400 bg-red-900/50 p-6 rounded-lg">
                                <p className="text-xl font-bold">发生错误</p>
                                <p>{error}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.3 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className="fixed bottom-6 right-6 z-50 bg-yellow-400/90 text-black px-5 py-3 rounded-lg shadow-2xl backdrop-blur-sm"
                    >
                        <p className="font-semibold">{notification}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BeatSyncPage;