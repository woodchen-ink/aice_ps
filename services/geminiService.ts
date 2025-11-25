
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;
let lastUsedApiKey: string | null = null;
let lastUsedBaseUrl: string | undefined | null = null;

// Function to get the current API key
const getApiKey = (): string | null => {
    // Get user-provided key from localStorage
    try {
      const userApiKey = localStorage.getItem('gemini-api-key');
      if (userApiKey && userApiKey.trim() !== '') {
          return userApiKey;
      }
    } catch(e) {
      console.warn("Could not access localStorage for API key.", e);
    }
    // No API key available
    return null;
}

// Function to get the current API Base URL
const getBaseUrl = (): string | undefined => {
    try {
        const userBaseUrl = localStorage.getItem('gemini-base-url');
        if (userBaseUrl && userBaseUrl.trim() !== '') {
            let url = userBaseUrl.trim();
            // Remove trailing slash if present to prevent double slashes in SDK
            if (url.endsWith('/')) {
                url = url.slice(0, -1);
            }
            return url;
        }
    } catch(e) {
      console.warn("Could not access localStorage for API base URL.", e);
    }

    // No base URL configured
    return undefined;
}


// Centralized function to get the GoogleGenAI instance
const getGoogleAI = (): GoogleGenAI => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("找不到 API 密钥。请通过 URL 参数（?server=xxx&key=xxx）配置您的 API 设置。");
    }
    const baseUrl = getBaseUrl();
    
    // Re-initialize if the API key or base URL has changed, or if there's no instance
    if (!aiInstance || apiKey !== lastUsedApiKey || baseUrl !== lastUsedBaseUrl) {
      try {
        const config: any = { apiKey };
        if (baseUrl) {
            // The @google/genai SDK uses httpOptions.baseUrl to override the endpoint
            config.httpOptions = {
                baseUrl: baseUrl
            };
        }
        aiInstance = new GoogleGenAI(config);
        lastUsedApiKey = apiKey;
        lastUsedBaseUrl = baseUrl;
      } catch(e) {
        console.error("Failed to initialize GoogleGenAI", e);
        aiInstance = null; // Invalidate on failure
        lastUsedApiKey = null;
        lastUsedBaseUrl = null;
        throw new Error(`初始化 AI 服务失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return aiInstance;
};

const handleApiError = (error: any, action: string): Error => {
    console.error(`API call for "${action}" failed:`, error);
    const baseUrl = getBaseUrl();
    
    // Start with the raw error message if available
    let message = `在“${action}”期间发生错误: ${error.message || '未知通信错误'}`;

    // Try to parse a detailed error message from a JSON response
    try {
      const errorObj = JSON.parse(error.message);
      if (errorObj?.error?.message) {
         message = `在“${action}”期间发生错误: ${errorObj.error.message}`;
      }
    } catch(e) {
      // If parsing fails, it's not JSON. Inspect the raw string for common issues.
      const errorMessage = String(error.message).toLowerCase();

      if (errorMessage.includes('api key not valid')) {
          if (baseUrl) {
              // When a custom URL is used, the key format can vary (e.g., 'sk-...').
              // The error is from the custom endpoint, so we provide a more general message.
              message = `API 请求失败。请检查您的 API 密钥和 Base URL 是否正确，并确保您的服务端点运行正常。`;
          } else {
              // When using the default Google endpoint, this error implies a standard Gemini key issue.
              message = 'API 密钥无效。请检查您在设置中输入的密钥。官方 Gemini API 密钥通常以 `AIzaSy...` 开头。';
          }
      } else if (errorMessage.includes('xhr error') || errorMessage.includes('failed to fetch')) {
           // General network or connectivity error.
           message = `与 AI 服务的通信失败。请检查您的网络连接、API 密钥和 Base URL 设置。`;
      }
    }

    return new Error(message);
}


// Helper to resize and convert image if necessary
const resizeImageForApi = async (file: File): Promise<{ file: File, mimeType: string }> => {
    const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png'];
    const MAX_DIMENSION = 2048;

    const needsConversion = !SUPPORTED_MIME_TYPES.includes(file.type);

    return new Promise((resolve, reject) => {
        const image = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            if (typeof e.target?.result !== 'string') {
                return reject(new Error('Failed to read file for processing.'));
            }
            image.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));

        image.onload = () => {
            const { naturalWidth: width, naturalHeight: height } = image;
            const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;

            // If no resize and no conversion is needed, we're good.
            if (!needsResize && !needsConversion) {
                return resolve({ file, mimeType: file.type });
            }

            // Otherwise, we need to draw to canvas.
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not create canvas context.'));
            }

            let newWidth = width;
            let newHeight = height;

            if (needsResize) {
                if (width > height) {
                    newWidth = MAX_DIMENSION;
                    newHeight = Math.round((height * MAX_DIMENSION) / width);
                } else {
                    newHeight = MAX_DIMENSION;
                    newWidth = Math.round((width * MAX_DIMENSION) / height);
                }
            }

            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx.drawImage(image, 0, 0, newWidth, newHeight);

            // Always convert to PNG when using canvas for simplicity and to handle transparency.
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        return reject(new Error('Failed to create blob from canvas.'));
                    }
                    const newFileName = (file.name.split('.').slice(0, -1).join('.') || 'image') + '.png';
                    const newFile = new File([blob], newFileName, { type: 'image/png' });
                    resolve({ file: newFile, mimeType: 'image/png' });
                },
                'image/png',
                0.95
            );
        };

        image.onerror = (err) => {
            reject(new Error(`Failed to load image for processing: ${err}`));
        };

        reader.readAsDataURL(file);
    });
};

// Helper to convert a File to a base64 string
const fileToGenerativePart = async (file: File) => {
    const { file: processedFile, mimeType } = await resizeImageForApi(file);
    const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(processedFile);
    });
    return {
        inlineData: {
            mimeType: mimeType,
            data: base64data,
        },
    };
};

const callImageEditingModel = async (parts: any[], action: string): Promise<string> => {
    try {
        const ai = getGoogleAI();
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const candidate = response.candidates?.[0];

        // Check for valid response structure
        if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            const finishReason = candidate?.finishReason;
            const safetyRatings = candidate?.safetyRatings;
            
            let detailedError = `AI did not return a valid result.`;
            if (finishReason) {
                detailedError += ` Reason: ${finishReason}.`;
            }
            if (safetyRatings?.some(r => r.blocked)) {
                detailedError += ` The prompt may have been blocked by safety filters.`;
            }
            throw new Error(detailedError);
        }

        for (const part of candidate.content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        
        // This is a special case for prompt-blocking or other non-image responses
        if (candidate.content.parts[0]?.text) {
             throw new Error("Model responded with text instead of an image. The prompt may have been blocked.");
        }

        throw new Error('AI 未能返回预期的图片结果。');
    } catch (e) {
        // Re-throw specific errors, otherwise wrap in a generic handler
        if (e instanceof Error && (e.message.includes("Model responded with text") || e.message.includes("AI did not return a valid result"))) {
            throw e;
        }
        throw handleApiError(e, action);
    }
}

export const generateImageFromText = async (prompt: string, aspectRatio: string, imageCount: number = 1): Promise<string[]> => {
    try {
        const ai = getGoogleAI();

        // Generate multiple images if requested
        const results: string[] = [];
        for (let i = 0; i < imageCount; i++) {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: {
                    parts: [{
                        text: `Generate an image with aspect ratio ${aspectRatio}: ${prompt}`
                    }]
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            const candidate = response.candidates?.[0];
            if (!candidate || !candidate.content || !candidate.content.parts) {
                throw new Error('AI 未能生成图片。');
            }

            // Extract image from response
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    results.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
                    break;
                }
            }
        }

        if (results.length === 0) {
            throw new Error('AI 未能生成图片。');
        }

        return results;
    } catch (e) {
        throw handleApiError(e, '生成图片');
    }
};

export const generateEditedImage = async (imageFile: File, prompt: string, hotspot: { x: number; y: number }): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: `Apply this edit at hotspot (${hotspot.x}, ${hotspot.y}): ${prompt}` };
    return callImageEditingModel([imagePart, textPart], '修饰');
};

export const generateFilteredImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const primaryTextPart = { text: `Apply this filter: ${prompt}` };
    try {
        return await callImageEditingModel([imagePart, primaryTextPart], '滤镜');
    } catch (error) {
        if (error instanceof Error && error.message.includes("Model responded with text instead of an image")) {
            console.warn("Original filter prompt failed. Trying a fallback without the English prefix.");
            const fallbackTextPart = { text: prompt };
            return await callImageEditingModel([imagePart, fallbackTextPart], '滤镜 (fallback)');
        }
        throw error;
    }
};

export const generateStyledImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const primaryTextPart = { text: `Apply this artistic style: ${prompt}` };
    try {
        return await callImageEditingModel([imagePart, primaryTextPart], '应用风格');
    } catch (error) {
        if (error instanceof Error && error.message.includes("Model responded with text instead of an image")) {
            console.warn("Original styled image prompt failed. Trying a fallback without the English prefix.");
            const fallbackTextPart = { text: prompt };
            return await callImageEditingModel([imagePart, fallbackTextPart], '应用风格 (fallback)');
        }
        throw error;
    }
};

export const generateAdjustedImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const primaryTextPart = { text: `Apply this adjustment: ${prompt}` };
    try {
        return await callImageEditingModel([imagePart, primaryTextPart], '调整');
    } catch (error) {
        if (error instanceof Error && error.message.includes("Model responded with text instead of an image")) {
            console.warn("Original adjustment prompt failed. Trying a fallback without the English prefix.");
            const fallbackTextPart = { text: prompt };
            return await callImageEditingModel([imagePart, fallbackTextPart], '调整 (fallback)');
        }
        throw error;
    }
};

export const generateTexturedImage = async (imageFile: File, prompt: string): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const primaryTextPart = { text: `Apply this texture: ${prompt}` };
    try {
        return await callImageEditingModel([imagePart, primaryTextPart], '纹理');
    } catch (error) {
        if (error instanceof Error && error.message.includes("Model responded with text instead of an image")) {
            console.warn("Original texture prompt failed. Trying a fallback without the English prefix.");
            const fallbackTextPart = { text: prompt };
            return await callImageEditingModel([imagePart, fallbackTextPart], '纹理 (fallback)');
        }
        throw error;
    }
};

export const removeBackgroundImage = async (imageFile: File): Promise<string> => {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = { text: 'Remove the background of this image, leaving only the main subject with a transparent background.' };
    return callImageEditingModel([imagePart, textPart], '抠图');
};

export const generateFusedImage = async (mainImage: File, sourceImages: File[], prompt: string): Promise<string> => {
    try {
        const mainImagePart = await fileToGenerativePart(mainImage);
        
        const sourceImageParts = await Promise.all(
            sourceImages.map((file, index) => fileToGenerativePart(file).then(part => ({ ...part, index: index + 1 })))
        );

        let fullPrompt = `Fuse the images. The main image is the one I'm editing. `;

        sourceImageParts.forEach(part => {
            fullPrompt += `Source image ${part.index} is provided. `;
        });
        
        fullPrompt += `Instructions: ${prompt}`;
        
        const textPart = { text: fullPrompt };
        const allParts = [mainImagePart, ...sourceImageParts.map(p => ({ inlineData: p.inlineData })), textPart];
        
        return await callImageEditingModel(allParts, '合成');

    } catch (e) {
       throw handleApiError(e, '合成');
    }
};

export const generateCreativeSuggestions = async (imageFile: File, type: 'filter' | 'adjustment' | 'texture'): Promise<{ name: string, prompt: string }[]> => {
    try {
        const ai = getGoogleAI();
        const imagePart = await fileToGenerativePart(imageFile);
        const textPrompt = `Analyze this image. Suggest 4 creative and interesting image ${type}s that would look good on it. Provide a very short, catchy name (2-4 words, in Chinese) and the corresponding detailed English prompt for each suggestion.`;
        const textPart = { text: textPrompt };

        const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: { parts: [ imagePart, textPart ]},
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: "A very short, catchy name for the effect in Chinese." },
                                    prompt: { type: Type.STRING, description: "The detailed English prompt to achieve the effect." }
                                }
                            }
                        }
                    }
                }
            }
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);
        return result.suggestions;
    } catch (e) {
        throw handleApiError(e, '获取灵感');
    }
};


// Past Forward Feature
const getFallbackPrompt = (decade: string) => `Create a photograph of the person in this image as if they were living in the ${decade}. The photograph should capture the distinct fashion, hairstyles, and overall atmosphere of that time period. Ensure the final image is a clear photograph that looks authentic to the era.`;

const extractDecade = (prompt: string) => {
    const match = prompt.match(/(\d{4}s)/);
    return match ? match[1] : null;
}

export const generateDecadeImage = async (imageDataUrl: string, prompt: string): Promise<string> => {
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!match) {
    throw new Error("Invalid image data URL format.");
  }
  const [, mimeType, base64Data] = match;

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };

    try {
        // First attempt with the primary prompt
        const textPart = { text: prompt };
        return await callImageEditingModel([imagePart, textPart], `生成 ${extractDecade(prompt)} 图像`);
    } catch (error) {
        // If it failed because the model returned text (prompt was likely blocked)
        if (error instanceof Error && error.message.includes("Model responded with text instead of an image")) {
            console.warn("Original prompt failed. Trying a fallback.");
            const decade = extractDecade(prompt);
            if (!decade) throw error; 
            
            // Second attempt with a safer, fallback prompt
            const fallbackPrompt = getFallbackPrompt(decade);
            const fallbackTextPart = { text: fallbackPrompt };
            return await callImageEditingModel([imagePart, fallbackTextPart], `生成 ${decade} 图像 (fallback)`);
        }
        // For other errors, re-throw them
        throw error;
    }
};
