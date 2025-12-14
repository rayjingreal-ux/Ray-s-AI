import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { UploadArea } from './components/UploadArea';
import { PromptEditor } from './components/PromptEditor';
import { ResultDisplay } from './components/ResultDisplay';
import { ActionSelector } from './components/ActionSelector';
import { MaskEditor, MaskEditorHandle } from './components/MaskEditor';
import { analyzeInteriorImage, generateRenderedImage } from './services/geminiService';
import { AppState, ImageFile, RenderHistoryItem } from './types';

function App() {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [sourceImage, setSourceImage] = useState<ImageFile | null>(null);
  const [analysisPrompt, setAnalysisPrompt] = useState<string>("");
  
  // History State instead of simple string array
  const [renderHistory, setRenderHistory] = useState<RenderHistoryItem[]>([]);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Masking State
  const [isMaskingMode, setIsMaskingMode] = useState(false);
  const maskEditorRef = useRef<MaskEditorHandle>(null);

  // Handlers
  const handleImageSelected = async (image: ImageFile) => {
    setSourceImage(image);
    setErrorMsg(null);
    setRenderHistory([]); // Clear history for new source image
    setAnalysisPrompt(""); // Clear previous prompts
    setIsMaskingMode(false); // Reset mask mode
    // Update: Stop at IMAGE_LOADED instead of auto-analyzing
    setAppState(AppState.IMAGE_LOADED);
  };

  const handleStartAnalysis = async () => {
    if (!sourceImage) return;

    setAppState(AppState.ANALYZING);
    try {
      const prompt = await analyzeInteriorImage(sourceImage.base64, sourceImage.mimeType);
      setAnalysisPrompt(prompt);
      setAppState(AppState.READY_TO_GENERATE);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "分析圖片失敗，請重試。");
      setAppState(AppState.ERROR);
    }
  };

  const handlePartialEdit = () => {
    if (!sourceImage) return;
    
    // Enable Masking Mode
    setIsMaskingMode(true);

    // Skip analysis, prepopulate with a template for partial editing
    const templatePrompt = "修改目標：\n(請在此描述您想對紅色遮罩區域進行的修改，例如：換成米色亞麻沙發...)";
    setAnalysisPrompt(templatePrompt);
    setAppState(AppState.READY_TO_GENERATE);
  };

  /**
   * Performs generation.
   * @param promptToUse The text prompt.
   * @param resolution '2K' | '4K'. Defaults to 2K for initial pass.
   * @param overrideSourceBase64 Optional. If provided (e.g., for upscaling or refining a result), uses this image as source.
   * @param overrideMaskBase64 Optional. Specific mask for this generation (overrides global mask editor state).
   */
  const performGeneration = async (
    promptToUse: string, 
    resolution: '2K' | '4K' = '2K', 
    overrideSourceBase64?: string,
    overrideMaskBase64?: string
  ) => {
    if (!sourceImage && !overrideSourceBase64) return;
    
    setAppState(AppState.GENERATING);
    setErrorMsg(null);

    const base64Input = overrideSourceBase64 || sourceImage?.base64;
    // If using override (the generated PNG), mimeType is png. Else use original.
    const mimeInput = overrideSourceBase64 ? 'image/png' : sourceImage?.mimeType || 'image/jpeg';

    if (!base64Input) return;

    // Determine Mask
    let maskBase64: string | undefined = undefined;

    // 1. Check if an explicit mask was passed (e.g. from ResultDisplay in-painting)
    if (overrideMaskBase64) {
      maskBase64 = overrideMaskBase64;
    } 
    // 2. Otherwise check if global masking mode is active on the source image
    else if (isMaskingMode && !overrideSourceBase64) {
      const mask = maskEditorRef.current?.getMaskBase64();
      if (mask) {
        maskBase64 = mask;
      }
    }

    try {
      // Step 2: Generate Render
      const results = await generateRenderedImage(
        base64Input, 
        mimeInput, 
        promptToUse,
        resolution,
        maskBase64
      );
      
      // Create new history item
      const newItem: RenderHistoryItem = {
        id: Date.now().toString(),
        imageUrl: results[0],
        prompt: promptToUse,
        resolution: resolution,
        timestamp: Date.now()
      };

      setRenderHistory(prev => [...prev, newItem]);
      setAppState(AppState.COMPLETE);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "生成渲染圖失敗。模型可能繁忙或請求無效。");
      setAppState(AppState.READY_TO_GENERATE); // Allow retry
    }
  };

  const handleGenerate = () => {
    if (analysisPrompt) {
      // Default to 2K for speed and preview
      performGeneration(analysisPrompt, '2K');
    }
  };

  const handleRefine = (refineText: string, maskBase64?: string, sourceOverride?: string) => {
    // Append the new instruction to the existing prompt if it's a general refine, 
    // or use it as the specific instruction if masking.
    
    let newPrompt = "";
    if (maskBase64) {
       // For masking/in-painting, the refine text is usually specific to the masked area
       newPrompt = `針對遮罩區域修改：${refineText}\n\n(保持其他區域不變)`;
    } else {
       newPrompt = `${analysisPrompt}\n\n修改要求: ${refineText}`;
       setAnalysisPrompt(newPrompt); // Update text area only for global refine
    }
    
    // Perform generation
    // If sourceOverride is present (modifying a result), use it.
    // If maskBase64 is present, use it.
    performGeneration(newPrompt, '2K', sourceOverride, maskBase64);
  };

  const handleUpscale = (targetImageBase64: string) => {
    // Upscale the specific image passed from ResultDisplay
    performGeneration(analysisPrompt, '4K', targetImageBase64);
  };

  const handleReset = () => {
    setSourceImage(null);
    setAnalysisPrompt("");
    setRenderHistory([]);
    setAppState(AppState.IDLE);
    setIsMaskingMode(false);
    setErrorMsg(null);
  };

  // Deprecated at App level, handled inside ResultDisplay now
  const handleDownload = () => {};

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-200 font-sans selection:bg-indigo-500/30">
      <Header />

      <main className="flex-grow w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
        {/* Error Notification */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl flex items-start justify-between animate-fadeIn shadow-lg shadow-red-900/20">
            <span className="flex items-start gap-2 whitespace-pre-line text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{errorMsg}</span>
            </span>
            <button onClick={() => setErrorMsg(null)} className="text-red-300 hover:text-white transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* Left Column: Input & Controls */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Step 1: Upload */}
            <div className={`transition-all duration-500 ${sourceImage ? 'opacity-100' : 'opacity-100'}`}>
              {!sourceImage ? (
                <UploadArea onImageSelected={handleImageSelected} />
              ) : (
                <div className="relative group rounded-2xl overflow-hidden border border-slate-700 shadow-lg bg-slate-800 flex justify-center items-center bg-black/20">
                  {/* Toggle between Static Image and Mask Editor */}
                  {isMaskingMode && appState !== AppState.ANALYZING ? (
                     <MaskEditor 
                       ref={maskEditorRef}
                       imageSrc={sourceImage.preview}
                     />
                  ) : (
                    <div className="w-full relative">
                       <img 
                        src={sourceImage.preview} 
                        alt="Source" 
                        className="w-full h-auto max-h-[45vh] object-contain opacity-100 transition-opacity"
                      />
                       <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent pointer-events-none"></div>
                       <div className="absolute bottom-0 left-0 p-4 w-full">
                          <p className="text-xs font-bold text-indigo-300 uppercase mb-1">來源圖片</p>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-white truncate max-w-[150px]">{sourceImage.file.name}</span>
                            <button 
                              onClick={handleReset} 
                              disabled={appState === AppState.GENERATING}
                              className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors pointer-events-auto"
                            >
                              更換
                            </button>
                          </div>
                       </div>
                    </div>
                  )}

                  {appState === AppState.ANALYZING && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                       <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                       <p className="text-sm font-medium text-white animate-pulse">正在分析幾何結構與風格...</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Action Choice (New) */}
            {sourceImage && appState === AppState.IMAGE_LOADED && (
              <ActionSelector 
                onAnalyze={handleStartAnalysis} 
                onPartialEdit={handlePartialEdit} 
              />
            )}

            {/* Step 3: Prompt Editor */}
            {sourceImage && (appState === AppState.READY_TO_GENERATE || appState === AppState.GENERATING || appState === AppState.COMPLETE) && (
               <div className="flex-grow bg-slate-800/50 rounded-2xl p-1 border border-slate-800">
                  <div className="bg-slate-900 rounded-xl p-4 h-full border border-slate-800 shadow-inner">
                    <PromptEditor 
                      prompt={analysisPrompt} 
                      setPrompt={setAnalysisPrompt}
                      onGenerate={handleGenerate}
                      isGenerating={appState === AppState.GENERATING}
                      onRegenerateAnalysis={handleStartAnalysis}
                    />
                  </div>
               </div>
            )}
          </div>

          {/* Right Column: Output */}
          <div className="lg:col-span-8 min-h-[500px] flex flex-col">
            {appState === AppState.IDLE || appState === AppState.IMAGE_LOADED || (appState === AppState.ANALYZING && renderHistory.length === 0) ? (
              <div className="flex-grow rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/50 flex flex-col items-center justify-center text-slate-600 p-8">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 opacity-50">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-slate-500">視覺化預覽</h3>
                <p className="max-w-md text-center mt-2 text-sm">
                  {appState === AppState.IMAGE_LOADED 
                    ? "圖片已就緒，請在左側選擇「分析」或「修改」以開始設計。" 
                    : "上傳圖片並生成提示詞，即可在此查看 AI 增強的室內設計。"
                  }
                </p>
              </div>
            ) : appState === AppState.GENERATING && renderHistory.length === 0 ? (
              <div className="flex-grow rounded-3xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                 {/* Fancy loading animation */}
                 <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 animate-pulse"></div>
                 <div className="relative z-10 text-center">
                    <div className="inline-block relative">
                       <div className="w-20 h-20 border-4 border-indigo-500/30 rounded-full"></div>
                       <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mt-6">正在渲染場景</h3>
                    <p className="text-slate-400 mt-2">
                       {isMaskingMode ? "正在根據遮罩區域進行局部重繪..." : "正在應用材質、光線和風格..."}
                    </p>
                 </div>
              </div>
            ) : (renderHistory.length > 0 && sourceImage) && (
              <ResultDisplay 
                originalImage={sourceImage.preview}
                history={renderHistory}
                onDownload={handleDownload}
                onClose={handleReset}
                onRefine={handleRefine}
                onUpscale={handleUpscale}
                isRefining={appState === AppState.GENERATING}
              />
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-600 border-t border-slate-800/50 flex flex-col items-center gap-2">
         <p>© {new Date().getFullYear()} Ray's DesignLens AI. 由 Google Gemini 3 Pro 驅動。</p>
      </footer>
    </div>
  );
}

export default App;