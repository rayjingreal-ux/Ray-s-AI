import React from 'react';

interface ActionSelectorProps {
  onAnalyze: () => void;
  onPartialEdit: () => void;
}

export const ActionSelector: React.FC<ActionSelectorProps> = ({ onAnalyze, onPartialEdit }) => {
  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      <div className="text-sm text-slate-400 font-medium mb-1">請選擇處理方式：</div>
      
      <button
        onClick={onAnalyze}
        className="group relative w-full p-5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-indigo-500/50 rounded-xl text-left transition-all hover:shadow-lg hover:shadow-indigo-500/10 flex items-start gap-4"
      >
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-200 mb-1 group-hover:text-white">智慧風格分析 (AI Analyze)</h3>
          <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300">
            讓 AI 自動識別圖片中的空間結構、材質與光影，並生成詳細的渲染提示詞。適合需要完整渲染或重塑風格時使用。
          </p>
        </div>
      </button>

      <button
        onClick={onPartialEdit}
        className="group relative w-full p-5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-left transition-all hover:shadow-lg hover:shadow-emerald-500/10 flex items-start gap-4"
      >
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-200 mb-1 group-hover:text-white">局部修改 (Partial Edit)</h3>
          <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300">
            跳過分析，直接進入編輯模式。適合保留原圖大部分內容，僅針對特定家具、材質或顏色進行手動調整。
          </p>
        </div>
      </button>
    </div>
  );
};