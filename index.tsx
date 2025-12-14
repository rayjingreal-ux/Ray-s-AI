import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { setManualApiKey } from './services/geminiService';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const Main = () => {
  const [hasKey, setHasKey] = useState(false);
  const [checking, setChecking] = useState(true);
  const [manualKeyInput, setManualKeyInput] = useState('');

  useEffect(() => {
    const checkKey = async () => {
      // 1. Check Local Storage first
      const storedKey = localStorage.getItem('gemini_api_key');
      if (storedKey) {
        setManualApiKey(storedKey);
        setHasKey(true);
        setChecking(false);
        return;
      }

      // 2. Check AI Studio environment
      try {
        if (window.aistudio) {
          const selected = await window.aistudio.hasSelectedApiKey();
          if (selected) {
            setHasKey(true);
          }
        }
      } catch (e) {
        console.error("Error checking API key status", e);
      } finally {
        setChecking(false);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      // Open the selection dialog
      await window.aistudio.openSelectKey();
      // Assume success to mitigate race condition and proceed immediately
      setHasKey(true);
    }
  };

  const handleManualSubmit = () => {
    if (!manualKeyInput.trim()) return;
    const key = manualKeyInput.trim();
    localStorage.setItem('gemini_api_key', key);
    setManualApiKey(key);
    setHasKey(true);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (hasKey) {
    return (
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-slate-200 font-sans">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center">
        <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-indigo-400">
             <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
           </svg>
        </div>
        <h1 className="text-2xl font-bold mb-4 text-white">需要 API 金鑰</h1>
        <p className="mb-6 text-slate-400 leading-relaxed text-sm">
          為了使用 <strong>Gemini 3 Pro</strong> 高階模型進行設計渲染，
          您需要提供已啟用計費功能的 Google Gemini API 金鑰。
        </p>
        
        {/* Environment Selection */}
        {window.aistudio && (
          <button 
            onClick={handleSelectKey}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 mb-4 active:scale-[0.98]"
          >
            連結 Google Cloud 專案
          </button>
        )}

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-800 px-2 text-slate-500">或手動輸入</span>
          </div>
        </div>

        {/* Manual Input */}
        <div className="space-y-3">
            <input
                type="password"
                placeholder="貼上您的 Gemini API Key"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                value={manualKeyInput}
                onChange={(e) => setManualKeyInput(e.target.value)}
            />
            <button
                onClick={handleManualSubmit}
                disabled={!manualKeyInput}
                className="w-full py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
                儲存並開始
            </button>
        </div>
        
        <p className="text-xs text-slate-500 mt-6">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline hover:text-indigo-300">
            在此獲取 API Key
          </a>
        </p>
      </div>
    </div>
  );
};

root.render(<Main />);