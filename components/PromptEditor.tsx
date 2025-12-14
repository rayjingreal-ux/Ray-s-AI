import React from 'react';
import { getCostMessage } from '../services/pricingService';

interface PromptEditorProps {
  prompt: string;
  setPrompt: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  onRegenerateAnalysis: () => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({ 
  prompt, 
  setPrompt, 
  onGenerate, 
  isGenerating,
  onRegenerateAnalysis
}) => {
  return (
    <div className="flex flex-col h-full animate-fadeIn">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">設計提示詞 (Prompt)</h3>
        <button 
          onClick={onRegenerateAnalysis}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          disabled={isGenerating}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
          重新分析
        </button>
      </div>
      
      {/* Reduced min-height from 450px to 270px (60%) */}
      <div className="relative flex-grow group min-h-[270px]">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full h-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none text-sm leading-relaxed"
          placeholder="正在分析圖片結構與風格..."
        />
        <div className="absolute bottom-4 right-4 text-xs text-slate-500 pointer-events-none bg-slate-800/80 px-2 py-1 rounded">
          編輯以微調結果
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {/* Cost Estimation Label */}
        <div className="flex justify-end px-1">
          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-400">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.732 6.232a2.5 2.5 0 013.536 0 .75.75 0 101.06-1.06A4 4 0 006.5 8v.165c0 .364.034.709.13 1.04l.64 2.158c.158.532.553.945 1.053 1.136a2.503 2.503 0 01-1.554-2.268V10a.75.75 0 00-1.5 0v.165a4.002 4.002 0 002.768 3.868l-.64 2.158a2.503 2.503 0 01-3.264-1.92.75.75 0 10-1.447.395 4.003 4.003 0 005.196 3.03l.64-2.159a4 4 0 001.053-1.135c.096-.33.13-.676.13-1.04v-.165a2.5 2.5 0 011.554 2.267v.166a.75.75 0 001.5 0v-.166a4.002 4.002 0 00-2.768-3.868l.64-2.158a2.503 2.503 0 013.264 1.92.75.75 0 101.447-.395 4.003 4.003 0 00-5.196-3.03l-.64 2.159a4 4 0 00-1.053 1.135c-.096.33-.13.676-.13 1.04v.165a2.5 2.5 0 01-1.554-2.267V8a.75.75 0 00-1.5 0v.166z" clipRule="evenodd" />
             </svg>
             {getCostMessage()}
          </span>
        </div>

        <button
          onClick={onGenerate}
          disabled={isGenerating || !prompt}
          className={`
            w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]
            ${isGenerating || !prompt
              ? 'bg-slate-700 cursor-not-allowed text-slate-400'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/25 hover:from-indigo-500 hover:to-purple-500'
            }
          `}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              深度渲染中...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM9 15a.75.75 0 01.75.75v1.5h1.5a.75.75 0 010 1.5h-1.5v1.5a.75.75 0 01-1.5 0v-1.5h-1.5a.75.75 0 010-1.5h1.5v-1.5A.75.75 0 019 15z" clipRule="evenodd" />
              </svg>
              生成渲染圖
            </>
          )}
        </button>
      </div>
    </div>
  );
};