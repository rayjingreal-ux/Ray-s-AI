import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

let manualApiKey: string | null = null;

export const setManualApiKey = (key: string) => {
  manualApiKey = key;
};

const getApiKey = (): string | undefined => {
  // Safe access to process.env for browser environments where process might not be defined
  const envKey = typeof process !== "undefined" && process.env ? process.env.API_KEY : undefined;
  return manualApiKey || envKey;
};

const handleApiError = (error: any, context: string) => {
  console.error(`${context} Error:`, error);
  
  let msg = `${context}失敗。`;
  const errorStr = JSON.stringify(error);
  const errorMessage = error.message || errorStr;

  if (errorMessage.includes("403") || error.status === 403 || error.code === 403) {
    msg = `${context}失敗 (權限不足 403)。\n請確認：\n1. 您的 API Key 專案已啟用計費功能 (Gemini 3 Pro 需要)。\n2. 所在地區支援此模型。\n3. API Key 未設定阻擋此網域的限制。`;
  } else if (errorMessage.includes("404") || error.status === 404 || error.code === 404) {
    msg = `${context}失敗 (404)。\n找不到模型 (可能未對此 API Key 開放)，請稍後再試。`;
  } else if (errorMessage.includes("429") || error.status === 429) {
    msg = `${context}失敗 (請求過多 429)。\n您已達到 API 額度限制，請稍後再試。`;
  } else if (errorMessage.includes("503") || error.status === 503) {
    msg = `${context}失敗 (服務過載 503)。\nGoogle 伺服器目前繁忙，請稍待片刻再試，或系統將自動切換模型。`;
  } else if (errorMessage.includes("500") || error.status === 500 || error.code === 500) {
    msg = `${context}失敗 (伺服器錯誤 500)。\nGoogle 內部發生錯誤，請稍後重試。`;
  } else {
    msg += ` ${errorMessage}`;
  }
  
  throw new Error(msg);
};

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Analyzes the uploaded image to determine style and creates a prompt in Traditional Chinese.
 * Uses Gemini 3 Pro with Reduced Thinking Config for speed.
 */
export const analyzeInteriorImage = async (base64Image: string, mimeType: string): Promise<string> => {
  const apiKey = getApiKey();
  
  if (!apiKey) throw new Error("找不到 API Key。請確認已連結 Google Cloud 專案或手動輸入 Key。");

  const ai = new GoogleGenAI({ apiKey });

  // Retry logic for 503 and 500 errors
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      // Primary model: Gemini 3 Pro
      const model = 'gemini-3-pro-preview';
      const prompt = `
        你是一位頂尖的室內設計師與 3D 渲染專家。
        請快速且精準地分析附圖的透視線條、空間幾何與設計潛力。

        你的任務是產生一個供 AI 繪圖使用的「完整且詳盡」的繁體中文提示詞 (Prompt)，供使用者後續編輯微調。

        請依序思考：
        1. 識別必須「絕對嚴格遵守」的透視線條、家具位置與物件輪廓。
        2. 快速構思空間的材質細節（地板、牆面、家具面料）、光影邏輯（光源方向、氛圍）以及整體設計風格。

        **最終輸出要求：**
        1. **描述具體**：提供清晰的材質與光影描述。
        2. **涵蓋關鍵元素**：風格流派、主要材質、光影氛圍。
        3. **必要指令**：必須在開頭包含「嚴格遵守原圖線條與幾何結構」這句話。
        4. **格式**：直接輸出一篇場景描述文章，不需條列式，以便使用者直接編輯。
      `;

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            }
          ]
        },
        config: {
          thinkingConfig: {
            thinkingBudget: 2048 
          }
        }
      });

      return response.text ? response.text.trim() : "無法生成分析結果。";
    } catch (error: any) {
      const isTransient = error.message?.includes("503") || error.status === 503 || error.status === 500 || error.code === 500 || error.message?.includes("Internal error");
      
      if (isTransient && attempts < maxAttempts - 1) {
        attempts++;
        console.warn(`Model error (${error.status || 'unknown'}). Retrying analysis (${attempts}/${maxAttempts})...`);
        await delay(2000 * attempts); // Exponential backoff
        continue;
      }
      
      // Fallback to Flash if Pro fails after retries
      if (isTransient) {
        console.warn("Gemini 3 Pro failed. Falling back to Gemini 2.5 Flash for analysis.");
        try {
          const fallbackModel = 'gemini-2.5-flash';
          const response = await ai.models.generateContent({
            model: fallbackModel,
            contents: {
                parts: [
                    { text: "分析這張室內設計圖並產生詳盡的繁體中文生成提示詞。要求：嚴格保持原圖線條結構不變，詳細渲染材質與光影。" }, 
                    { inlineData: { mimeType, data: base64Image } }
                ]
            }
          });
          return response.text ? response.text.trim() : "無法生成分析結果。";
        } catch (fallbackError) {
           handleApiError(fallbackError, "圖片分析 (Fallback)");
        }
      }

      handleApiError(error, "圖片分析");
    }
  }
  return "";
};

/**
 * Helper function to generate a single image.
 */
const generateSingleImage = async (
  ai: GoogleGenAI,
  base64Source: string, 
  sourceMimeType: string, 
  userPrompt: string,
  resolution: '2K' | '4K',
  maskBase64?: string
): Promise<string> => {
  const tryGenerate = async (model: string, config: any = {}) => {
      let finalPrompt = '';
      const parts: any[] = [];

      if (resolution === '4K' && !maskBase64) {
        // --- 4K Upscale Mode ---
        finalPrompt = `
          這是一個「4K 畫質提升 (Upscale)」任務。
          請參考附圖（這是已經渲染過的預覽圖），將其解析度與細節品質提升至 4K 照片級水準。

          **絕對嚴格指令 (CRITICAL INSTRUCTIONS)：**
          1. **完全忠於原圖 (High Fidelity)**：必須 100% 保留附圖中的構圖、家具位置、配色與光影氛圍。**請勿重新設計**或改變任何物件的位置。
          2. **細節增強 (Detail Enhancement)**：你的重點是增加材質的紋理（如木紋、織品、石材的細節）、銳利度與光線的自然感。
          3. **消除噪點**：修復原圖中可能存在的模糊或不清楚的細節。
          
          原始設計風格參考：${userPrompt}
        `;
        
        parts.push({ text: finalPrompt });
        parts.push({
          inlineData: {
            mimeType: sourceMimeType,
            data: base64Source
          }
        });

      } else if (maskBase64) {
        // --- In-painting / Mask Mode ---
        finalPrompt = `
          這是一個「局部修改 (In-painting)」任務。
          
          我提供了兩張圖片：
          1. 原始圖片。
          2. 遮罩圖片（黑底白字）：白色區域代表**必須修改**的範圍，黑色區域代表**必須保持原樣**的範圍。

          **指令：**
          請僅針對遮罩（白色）區域，根據以下描述進行重新設計與渲染，同時確保修改部分與周圍環境的光影、透視完美融合。
          
          **修改描述：**
          ${userPrompt}
        `;

        parts.push({ text: finalPrompt });
        // Source Image
        parts.push({
          inlineData: {
            mimeType: sourceMimeType,
            data: base64Source
          }
        });
        // Mask Image
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: maskBase64
          }
        });

      } else {
        // --- Standard Generation Mode ---
        finalPrompt = `
          請根據提供的參考圖片結構，生成一張高品質、照片級真實感的室內設計渲染圖。
          
          **絕對嚴格指令 (CRITICAL INSTRUCTIONS)：**
          1. **視角與線條完全鎖定 (Locked Perspective & Lines)**：生成的圖片必須「絕對嚴格遵守」原圖的透視角度、線條結構與幾何形狀。
          2. **禁止變形 (No Distortion)**：牆壁位置、天花板高度、家具輪廓與窗戶位置**不可更改**。這是一項「上色與材質渲染」任務，而非空間重新設計。
          3. **結構重疊 (Structural Overlay)**：生成的影像必須能與原圖的線條圖完美重疊。
          
          設計風格描述：${userPrompt}
        `;

        parts.push({ text: finalPrompt });
        parts.push({
          inlineData: {
            mimeType: sourceMimeType,
            data: base64Source
          }
        });
      }

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: model,
        contents: {
          parts: parts
        },
        config: config
      });

      const resParts = response.candidates?.[0]?.content?.parts;
      if (!resParts) throw new Error("API 未回傳任何內容，請重試。");

      for (const part of resParts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
      throw new Error("回傳結果中未找到圖片資料。");
  };

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
      try {
          // Primary: Gemini 3 Pro Image
          return await tryGenerate('gemini-3-pro-image-preview', {
              imageConfig: {
                  aspectRatio: "4:3",
                  imageSize: resolution // Dynamic resolution: '2K' or '4K'
              }
          });
      } catch (error: any) {
          // Check for 500 (Internal), 503 (Unavailable), etc.
          const isTransient = error.message?.includes("503") || error.status === 503 || error.status === 500 || error.code === 500 || error.message?.includes("Internal error");
          
          if (isTransient && attempts < maxAttempts - 1) {
              attempts++;
              console.warn(`Generation error (${error.status || 'unknown'}). Retrying (${attempts}/${maxAttempts})...`);
              await delay(2000 * attempts);
              continue;
          }

          if (isTransient) {
             console.warn("Fallback to Gemini 2.5 Flash Image.");
             try {
                // Flash image doesn't support 'imageSize' but supports 'aspectRatio'
                return await tryGenerate('gemini-2.5-flash-image', {
                    imageConfig: {
                        aspectRatio: "4:3"
                    }
                });
             } catch (fallbackError) {
                 handleApiError(fallbackError, "圖片渲染 (Fallback)");
             }
          }

          throw error;
      }
  }
  return "";
};

/**
 * Generates rendered images based on the source image and user's prompt.
 * Always generates a SINGLE high-quality image.
 */
export const generateRenderedImage = async (
  base64Source: string, 
  sourceMimeType: string, 
  userPrompt: string,
  resolution: '2K' | '4K' = '2K', // Default to 2K for speed/preview
  maskBase64?: string // Optional Mask
): Promise<string[]> => {
  const apiKey = getApiKey();

  if (!apiKey) throw new Error("找不到 API Key。");

  const ai = new GoogleGenAI({ apiKey });

  // Strictly single image generation
  try {
    const result = await generateSingleImage(ai, base64Source, sourceMimeType, userPrompt, resolution, maskBase64);
    return [result]; // Return as array for compatibility
  } catch (e) {
    console.error("Generation failed:", e);
    throw e;
  }
};