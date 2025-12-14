import React, { useState, useEffect, useRef } from 'react';
import { RenderHistoryItem } from '../types';
import { MaskEditor, MaskEditorHandle } from './MaskEditor';
import { getCostMessage } from '../services/pricingService';

interface ResultDisplayProps {
  originalImage: string;
  history: RenderHistoryItem[]; 
  onDownload: () => void;
  onClose: () => void;
  onRefine: (refineText: string, maskBase64?: string, sourceOverride?: string) => void;
  onUpscale: (base64Image: string) => void; 
  isRefining: boolean;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ 
  originalImage, 
  history,
  onDownload, 
  onClose,
  onRefine,
  onUpscale,
  isRefining
}) => {
  const [activeTab, setActiveTab] = useState<'generated' | 'original' | 'split'>('generated');
  const [refineInput, setRefineInput] = useState('');
  
  // Track selected item by index in the history array
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(history.length - 1);
  
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Masking / In-painting state
  const [isMasking, setIsMasking] = useState(false);
  const maskEditorRef = useRef<MaskEditorHandle>(null);
  
  // Lightbox state
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // When history updates (new generation), auto-select the newest one and exit mask mode
  useEffect(() => {
    if (history.length > 0) {
        setSelectedHistoryIndex(history.length - 1);
        setIsMasking(false); // Reset mask mode on new result
    }
  }, [history.length]);

  const currentHistoryItem = history[selectedHistoryIndex];
  // Pure Base64 string for logic
  const currentGeneratedBase64 = currentHistoryItem?.imageUrl || '';
  // Data URL for display
  const currentGeneratedImageSrc = currentGeneratedBase64 
    ? `data:image/png;base64,${currentGeneratedBase64}` 
    : '';

  // Handle Escape key to close lightbox
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreenImage(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleRefineSubmit = () => {
    if (!refineInput.trim()) return;

    if (isMasking && maskEditorRef.current) {
        // Get mask from editor
        const maskBase64 = maskEditorRef.current.getMaskBase64();
        if (maskBase64) {
            // Send prompt + mask + CURRENT image as source
            onRefine(refineInput, maskBase64, currentGeneratedBase64);
        } else {
            // User entered mask mode but didn't paint anything, treat as normal refine
            onRefine(refineInput);
        }
    } else {
        // Normal refine (global)
        onRefine(refineInput);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRefineSubmit();
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `design-render-${timestamp}.png`;

      if (activeTab === 'split' && !isMasking) {
        // Stitch images for split view download
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const imgOriginal = new Image();
        const imgGenerated = new Image();

        // Load images
        await Promise.all([
          new Promise((resolve) => { imgOriginal.onload = resolve; imgOriginal.src = originalImage; }),
          new Promise((resolve) => { imgGenerated.onload = resolve; imgGenerated.src = currentGeneratedImageSrc; })
        ]);

        // Calculate dimensions (side by side)
        canvas.width = imgOriginal.width + imgGenerated.width;
        canvas.height = Math.max(imgOriginal.height, imgGenerated.height);

        // Draw
        ctx.drawImage(imgOriginal, 0, 0);
        ctx.drawImage(imgGenerated, imgOriginal.width, 0);

        link.href = canvas.toDataURL('image/png');
      } else if (activeTab === 'original' && !isMasking) {
        link.href = originalImage;
      } else {
        link.href = currentGeneratedImageSrc;
      }

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Download failed", e);
      alert("下載失敗，請重試");
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleMaskMode = () => {
      setIsMasking(!isMasking);
      // If turning on, reset active tab to generated so they paint on the result
      if (!isMasking) {
          setActiveTab('generated');
      }
  };

  // Check if current item is 4K
  const isHighRes = currentHistoryItem?.resolution === '4K';

  return (
    <div className="h-full flex flex-col bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-xl animate-fadeIn relative">
      {/* Lightbox Overlay */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-2 bg-slate-800/50 hover:bg-slate-700 text-white rounded-full transition-colors z-50"
            onClick={() => setFullscreenImage(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img 
            src={fullscreenImage} 
            alt="Fullscreen View" 
            className="max-w-full max-h-full object-contain shadow-2xl rounded-sm cursor-zoom-out"
            onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }} 
          />
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-slate-900/80 rounded-full text-slate-300 text-sm pointer-events-none">
            點擊任意處關閉
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-slate-900/50 border-b border-slate-700 flex-shrink-0 flex-wrap gap-2">
        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 order-1">
          <button 
            onClick={() => { setActiveTab('original'); setIsMasking(false); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'original' && !isMasking ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            原圖
          </button>
          <button 
            onClick={() => { setActiveTab('split'); setIsMasking(false); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'split' && !isMasking ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            對比視圖
          </button>
          <button 
            onClick={() => setActiveTab('generated')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'generated' || isMasking ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            渲染圖
          </button>
        </div>
        
        <div className="flex gap-2 items-center order-2 ml-auto">
          {/* Mask/In-paint Button */}
          {currentHistoryItem && !isRefining && (
             <button
                onClick={toggleMaskMode}
                className={`
                    flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all border
                    ${isMasking 
                        ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30' 
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white hover:border-slate-500'
                    }
                `}
                title="塗抹遮罩以進行局部重繪"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M15.98 1.804a1 1 0 00-1.215-.093l-4.178 2.506a1 1 0 00-.391 1.157l.805 3.22a1 1 0 001.693.303l1.833-2.75a1 1 0 00-.547-1.343zM3.68 12.016c-.752 3.008-1.554 5.346-1.666 5.67a1 1 0 001.312 1.313c.324-.112 2.663-.914 5.67-1.666a1 1 0 00.597-.372l8.243-10.99-3.535-3.536L3.308 11.42a1 1 0 00-.372.597z" />
                </svg>
                {isMasking ? '退出重繪模式' : '局部重繪'}
             </button>
          )}

          {/* Upscale Button */}
          {!isHighRes && !isRefining && currentHistoryItem && !isMasking && (
             <button
                onClick={() => onUpscale(currentGeneratedBase64)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-orange-500/20 active:scale-95 border border-white/10"
                title={`以此圖為基礎放大至 4K (${getCostMessage()})`}
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 animate-pulse">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                升級 4K
             </button>
          )}

          {/* Resolution Badge */}
          {currentHistoryItem && (
            <div className={`
                flex flex-col items-end px-3 py-1 rounded border leading-none
                ${isHighRes 
                   ? 'bg-yellow-500/10 border-yellow-500/30' 
                   : 'bg-slate-900/50 border-slate-700/50'
                }
            `}>
              <span className={`text-[9px] uppercase tracking-wider mb-0.5 ${isHighRes ? 'text-yellow-500' : 'text-slate-500'}`}>
                {isHighRes ? 'Ultra HD' : '預覽畫質'}
              </span>
              <span className={`text-xs font-mono font-bold ${isHighRes ? 'text-yellow-400' : 'text-indigo-300'}`}>
                {currentHistoryItem.resolution}
              </span>
            </div>
          )}

          <div className="h-6 w-px bg-slate-700 mx-1"></div>

          <button 
             onClick={handleDownload}
             disabled={isDownloading}
             className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2"
             title="下載當前視圖"
          >
            {isDownloading ? (
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 9.75v10.5m0 0l-3-3m3 3l3-3m-3-13.5l-4.5 4.5M12 3l4.5 4.5" />
              </svg>
            )}
          </button>
          <button 
             onClick={onClose}
             className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
             title="關閉 / 新增"
          >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div className="relative flex-grow bg-black/20 overflow-hidden flex flex-col items-center justify-center p-4">
        
        {/* Mask Editor Mode */}
        {isMasking && currentGeneratedImageSrc ? (
            <div className="w-full h-full max-h-full flex items-center justify-center">
                <MaskEditor 
                    ref={maskEditorRef}
                    imageSrc={currentGeneratedImageSrc}
                />
            </div>
        ) : (
            /* Normal View Mode */
            <div className="relative max-w-full max-h-full rounded-lg overflow-hidden shadow-2xl flex-grow flex items-center justify-center group">
                
                {/* Overlay hint */}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 backdrop-blur-sm">
                點擊圖片放大檢視
                </div>

                {activeTab === 'original' && (
                    <img 
                    src={originalImage} 
                    alt="Original" 
                    className="max-h-[50vh] object-contain cursor-zoom-in transition-transform hover:scale-[1.01]" 
                    onClick={() => setFullscreenImage(originalImage)}
                    />
                )}
                {activeTab === 'generated' && currentGeneratedImageSrc && (
                    <img 
                    src={currentGeneratedImageSrc} 
                    alt="Generated" 
                    className="max-h-[50vh] object-contain cursor-zoom-in transition-transform hover:scale-[1.01]" 
                    onClick={() => setFullscreenImage(currentGeneratedImageSrc)}
                    />
                )}
                {activeTab === 'split' && currentGeneratedImageSrc && (
                    <div className="relative flex gap-1 justify-center">
                        <img 
                        src={originalImage} 
                        alt="Original" 
                        className="max-h-[50vh] w-[49%] object-contain cursor-zoom-in hover:opacity-90 transition-opacity" 
                        onClick={() => setFullscreenImage(originalImage)}
                        title="點擊放大原圖"
                        />
                        <img 
                        src={currentGeneratedImageSrc} 
                        alt="Generated" 
                        className="max-h-[50vh] w-[49%] object-contain cursor-zoom-in hover:opacity-90 transition-opacity" 
                        onClick={() => setFullscreenImage(currentGeneratedImageSrc)}
                        title="點擊放大渲染圖"
                        />
                    </div>
                )}
            </div>
        )}

        {/* History Timeline */}
        {history.length > 0 && !isMasking && (
          <div className="mt-4 w-full">
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2 ml-1">渲染歷史紀錄</div>
            <div className="flex gap-3 overflow-x-auto pb-2 px-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {history.map((item, idx) => {
                const isSelected = selectedHistoryIndex === idx;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedHistoryIndex(idx)}
                    className={`
                      relative w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all group
                      ${isSelected 
                        ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-105 z-10' 
                        : 'border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-500 hover:scale-105'
                      }
                    `}
                  >
                    <img 
                      src={`data:image/png;base64,${item.imageUrl}`} 
                      alt={`Ver ${idx + 1}`} 
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Version Badge */}
                    <div className="absolute top-0 left-0 bg-black/60 backdrop-blur-[2px] text-white text-[10px] font-mono px-1.5 py-0.5 rounded-br-md border-b border-r border-white/10">
                      V{idx + 1}
                    </div>

                    {/* Resolution Badge */}
                    <div className={`
                      absolute bottom-0 right-0 text-[9px] font-bold px-1.5 py-0.5 rounded-tl-md
                      ${item.resolution === '4K' 
                        ? 'bg-yellow-500/90 text-black' 
                        : 'bg-slate-700/90 text-slate-300'
                      }
                    `}>
                      {item.resolution}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Refine Section */}
      <div className="p-4 bg-slate-800 border-t border-slate-700 flex-shrink-0">
        <div className="flex gap-3 flex-col">
          {/* Cost Estimation */}
          <div className="flex justify-end px-1">
             <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
               {getCostMessage()}
             </span>
          </div>

          <div className="flex gap-3">
            <div className="flex-grow relative">
              <input
                type="text"
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isMasking ? "輸入針對遮罩(紅色)區域的修改描述..." : "輸入整體修改指令 (例如: 將地板改為淺色木紋...)"}
                disabled={isRefining}
                className={`
                  w-full pl-4 pr-4 py-3 bg-slate-900 border rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all text-sm
                  ${isMasking 
                     ? 'border-red-500/30 focus:border-red-500 focus:ring-red-500/20' 
                     : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/50'
                  }
                `}
              />
            </div>
            <button
              onClick={handleRefineSubmit}
              disabled={isRefining || !refineInput.trim()}
              className={`
                px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-[0.98] whitespace-nowrap text-sm flex items-center gap-2
                ${isRefining || !refineInput.trim()
                  ? 'bg-slate-700 cursor-not-allowed text-slate-400'
                  : isMasking 
                      ? 'bg-red-600 hover:bg-red-500 shadow-red-500/25'
                      : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25'
                }
              `}
            >
              {isRefining ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  處理中
                </>
              ) : (
                 isMasking ? '執行局部重繪' : '更新渲染'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};