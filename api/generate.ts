import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, // Increase execution time for image generation
  api: {
    bodyParser: {
      sizeLimit: '4.5mb', // Vercel limit
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY_RAY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY_RAY is missing.' });
  }

  try {
    const { 
      base64Source, 
      sourceMimeType, 
      userPrompt, 
      resolution = '2K', 
      maskBase64 
    } = req.body;

    if (!base64Source || !sourceMimeType || !userPrompt) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Determine Logic (Upscale vs Inpainting vs Standard) based on params
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

    // Try primary model
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
        // Simple fallback logic for server side
        console.warn("Gemini 3 Pro Image failed, trying fallback...", e.message);
        if (maskBase64) throw e; // Fallback doesn't support mask well, throw error
        
        // Fallback to Flash
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

    return res.status(200).json({ image: imageBase64 });

  } catch (error: any) {
    console.error("API Generation Error:", error);
    return res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      details: error.toString() 
    });
  }
}