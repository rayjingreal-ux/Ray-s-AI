
export interface AnalysisResult {
  prompt: string;
  styles: string[];
}

export enum AppState {
  IDLE = 'IDLE',
  IMAGE_LOADED = 'IMAGE_LOADED', // New state: Uploaded but not analyzed
  ANALYZING = 'ANALYZING',
  READY_TO_GENERATE = 'READY_TO_GENERATE',
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface ImageFile {
  file: File;
  preview: string; // Base64 or Object URL
  base64: string; // Pure Base64 data for API
  mimeType: string;
}

export interface RenderHistoryItem {
  id: string;
  imageUrl: string; // Base64
  prompt: string;
  resolution: '2K' | '4K';
  timestamp: number;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
