// This service now acts as a bridge to the Vercel Serverless Functions
// No API Keys are handled here directly.

const handleApiError = (error: any, context: string) => {
  console.error(`${context} Error:`, error);
  let msg = `${context}失敗。`;
  
  if (error.message) {
      msg += ` ${error.message}`;
  }
  
  throw new Error(msg);
};

/**
 * Calls the backend /api/analyze endpoint
 */
export const analyzeInteriorImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image,
        mimeType
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server Error: ${response.status}`);
    }

    const data = await response.json();
    return data.text;

  } catch (error: any) {
    handleApiError(error, "圖片分析");
    return "";
  }
};

/**
 * Calls the backend /api/generate endpoint
 */
export const generateRenderedImage = async (
  base64Source: string, 
  sourceMimeType: string, 
  userPrompt: string,
  resolution: '2K' | '4K' = '2K',
  maskBase64?: string
): Promise<string[]> => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Source,
        sourceMimeType,
        userPrompt,
        resolution,
        maskBase64
      }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server Error: ${response.status}`);
    }

    const data = await response.json();
    return [data.image]; // Return as array to match previous interface

  } catch (e: any) {
    console.error("Generation failed:", e);
    throw e;
  }
};

// Deprecated functions kept empty for compatibility if imported elsewhere
export const setManualApiKey = (key: string) => {};
