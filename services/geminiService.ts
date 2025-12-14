import { GoogleGenAI } from "@google/genai";

// Initialize the GoogleGenAI client freshly for each call.
// This allows capturing the API Key if it is injected dynamically.
const getAI = () => {
  // 1. Try environment variable from IDX/AI Studio wrapper
  let key = process.env.API_KEY;
  
  // 2. Try Vercel/Vite environment variable
  if (!key) {
    key = (import.meta as any).env?.VITE_API_KEY;
  }

  if (!key) {
    throw new Error("API Key 尚未設定。請確認環境變數 VITE_API_KEY 已設定，或重新連結 Google AI 帳號。");
  }
  return new GoogleGenAI({ apiKey: key });
};

export const analyzeInteriorImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const ai = getAI();
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

    const response = await ai.models.generateContent({
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
      }
    });

    return response.text ? response.text.trim() : "無法生成分析結果。";

  } catch (error: any) {
    console.error("Analysis Error:", error);
    throw new Error(error.message || "圖片分析失敗");
  }
};

export const generateRenderedImage = async (
  base64Source: string, 
  sourceMimeType: string, 
  userPrompt: string,
  resolution: '2K' | '4K' = '2K',
  maskBase64?: string
): Promise<string[]> => {
  try {
    const ai = getAI();
    let finalPrompt = '';
    const parts: any[] = [];

    // --- Logic: Upscale vs In-painting vs Standard ---
    if (resolution === '4K' && !maskBase64) {
        // Upscale
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
        // In-painting
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
        parts.push({
          inlineData: {
            mimeType: sourceMimeType,
            data: base64Source
          }
        });
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: maskBase64
          }
        });

    } else {
        // Standard
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

    // Try primary model: gemini-3-pro-image-preview
    let response;
    try {
        response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: parts },
            config: {
                imageConfig: {
                    aspectRatio: "4:3",
                    imageSize: resolution
                }
            }
        });
    } catch (e: any) {
        // Fallback Logic
        console.warn("Gemini 3 Pro Image failed, trying fallback to Flash...", e.message);
        if (maskBase64) throw e; 
        
        // Fallback to Flash Image (nano banana)
        response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: parts },
            config: {
                imageConfig: { aspectRatio: "4:3" }
            }
        });
    }

    const resParts = response.candidates?.[0]?.content?.parts;
    if (!resParts) throw new Error("API did not return content.");

    let imageBase64 = null;
    for (const part of resParts) {
      if (part.inlineData && part.inlineData.data) {
        imageBase64 = part.inlineData.data;
        break;
      }
    }

    if (!imageBase64) throw new Error("No image data found in response.");

    return [imageBase64];

  } catch (error: any) {
    console.error("Generation failed:", error);
    throw error;
  }
};

export const setManualApiKey = (_key: string) => {};