import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, // Set timeout to 60 seconds (Vercel Pro, or max allowed on Hobby)
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Use the standard API_KEY environment variable
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: API_KEY is missing. Please set API_KEY in your environment variables.' });
  }

  try {
    const { base64Image, mimeType } = req.body;

    if (!base64Image || !mimeType) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Logic moved from frontend to backend
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
      },
      config: {
        thinkingConfig: {
          thinkingBudget: 2048 
        }
      }
    });

    const text = response.text ? response.text.trim() : "無法生成分析結果。";
    return res.status(200).json({ text });

  } catch (error: any) {
    console.error("API Analysis Error:", error);
    return res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      details: error.toString()
    });
  }
}