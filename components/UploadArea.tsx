import React, { useCallback, useState } from 'react';
import { ImageFile } from '../types';

interface UploadAreaProps {
  onImageSelected: (image: ImageFile) => void;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ onImageSelected }) => {
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('請上傳圖片檔案 (JPEG, PNG, WEBP)。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // Extract pure base64 for API (remove data:image/xxx;base64, prefix)
      const base64 = result.split(',')[1];
      
      onImageSelected({
        file,
        preview: result,
        base64,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  }, [onImageSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  return (
    <div 
      className={`relative w-full h-80 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-6
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]' 
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
        }
      `}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        accept="image/*" 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
        onChange={handleFileInput}
      />
      
      <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4 group-hover:bg-slate-700 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      </div>
      
      <h3 className="text-lg font-semibold text-slate-200 mb-2">上傳原始草圖或照片</h3>
      <p className="text-sm text-slate-400 text-center max-w-xs">
        拖放檔案或點擊瀏覽。<br/>
        支援 JPEG, PNG, WEBP (最大 10MB)。
      </p>
    </div>
  );
};