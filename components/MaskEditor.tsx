import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

interface MaskEditorProps {
  imageSrc: string;
  width?: number;
  height?: number;
  onMaskChange?: (hasMask: boolean) => void;
}

export interface MaskEditorHandle {
  getMaskBase64: () => string | null;
}

export const MaskEditor = forwardRef<MaskEditorHandle, MaskEditorProps>(({ 
  imageSrc, 
  onMaskChange 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [hasStrokes, setHasStrokes] = useState(false);
  
  // Store drawing paths to redraw for the final mask output
  // Each path is { points: {x, y}[], size: number }
  const paths = useRef<Array<{ points: {x: number, y: number}[], size: number }>>([]);
  const currentPath = useRef<{x: number, y: number}[]>([]);

  // Setup canvas size based on image natural size for high precision
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      if (canvasRef.current && containerRef.current) {
        // Set canvas resolution to match image natural resolution
        canvasRef.current.width = img.naturalWidth;
        canvasRef.current.height = img.naturalHeight;
        
        // Render initial visual state
        draw();
      }
    };
  }, [imageSrc]);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getMaskBase64: () => {
      if (paths.current.length === 0) return null;

      const canvas = canvasRef.current;
      if (!canvas) return null;

      // Create an offscreen canvas to generate the black/white mask
      const offCanvas = document.createElement('canvas');
      offCanvas.width = canvas.width;
      offCanvas.height = canvas.height;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) return null;

      // 1. Fill Background Black (Protected area)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

      // 2. Draw Paths White (Edit area)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#FFFFFF';

      paths.current.forEach(path => {
        if (path.points.length < 1) return;
        ctx.lineWidth = path.size;
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      });

      // Return generated PNG
      return offCanvas.toDataURL('image/png').split(',')[1];
    }
  }));

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const coords = getCoordinates(e);
    currentPath.current = [coords];
    draw();
  };

  const drawMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    currentPath.current.push(coords);
    draw();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      if (currentPath.current.length > 0) {
        paths.current.push({
          points: [...currentPath.current],
          size: brushSize
        });
        setHasStrokes(true);
        onMaskChange?.(true);
      }
      currentPath.current = [];
      draw(); // Final redraw to bake it in visually
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Style for visual feedback (Red semi-transparent)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.5)'; // Visual mask color
    
    // Draw committed paths
    paths.current.forEach(path => {
      ctx.lineWidth = path.size;
      ctx.beginPath();
      if (path.points.length > 0) {
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        ctx.stroke();
      }
    });

    // Draw current active path
    if (isDrawing && currentPath.current.length > 0) {
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.moveTo(currentPath.current[0].x, currentPath.current[0].y);
      for (let i = 1; i < currentPath.current.length; i++) {
        ctx.lineTo(currentPath.current[i].x, currentPath.current[i].y);
      }
      ctx.stroke();
    }
  };

  const clearMask = () => {
    paths.current = [];
    currentPath.current = [];
    setHasStrokes(false);
    onMaskChange?.(false);
    draw();
  };

  return (
    <div className="flex flex-col gap-3 w-full h-full animate-fadeIn" ref={containerRef}>
      <div className="relative w-full h-auto bg-slate-900 rounded-lg overflow-hidden border border-slate-700 group">
        {/* Background Image */}
        <img 
          src={imageSrc} 
          alt="Original" 
          className="w-full h-auto max-h-[45vh] object-contain select-none pointer-events-none"
        />
        
        {/* Drawing Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={drawMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={drawMove}
          onTouchEnd={stopDrawing}
        />

        {/* Floating Tooltip/Hint */}
        <div className="absolute top-4 left-4 pointer-events-none bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs text-white border border-white/10">
          塗抹以建立遮罩 (紅色區域為修改範圍)
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3 flex-grow">
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">筆刷大小</span>
          <input 
            type="range" 
            min="5" 
            max="100" 
            value={brushSize} 
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-full max-w-[200px] accent-indigo-500 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer"
          />
          <div 
            className="w-6 h-6 rounded-full bg-indigo-500/50 flex-shrink-0 border border-white/20"
            style={{ width: Math.min(24, Math.max(8, brushSize / 4)), height: Math.min(24, Math.max(8, brushSize / 4)) }}
          />
        </div>

        <button
          onClick={clearMask}
          disabled={!hasStrokes}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5
            ${hasStrokes 
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30' 
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }
          `}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
          </svg>
          清除
        </button>
      </div>
    </div>
  );
});

MaskEditor.displayName = 'MaskEditor';
