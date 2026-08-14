import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  defaultSize?: { width: number; height: number };
}

export function DraggableModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  defaultSize = { width: 500, height: 400 } 
}: DraggableModalProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (isOpen && !isInitialized) {
      // Center the modal on first open
      setPosition({
        x: Math.max(0, (window.innerWidth - defaultSize.width) / 2),
        y: Math.max(0, (window.innerHeight - defaultSize.height) / 2)
      });
      setSize(defaultSize);
      setIsInitialized(true);
    }
  }, [isOpen, isInitialized, defaultSize]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition(prev => ({
          x: prev.x + e.movementX,
          y: Math.max(0, prev.y + e.movementY) // Prevent dragging above top edge
        }));
      } else if (isResizing) {
        setSize(prev => ({
          width: Math.max(300, prev.width + e.movementX),
          height: Math.max(200, prev.height + e.movementY)
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      document.body.style.userSelect = 'auto';
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevent text selection during drag/resize
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging, isResizing, isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed z-[100] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-xl flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/10 transition-shadow hover:shadow-3xl"
      style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
    >
      {/* Header / Drag Handle */}
      <div 
        className="h-12 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 cursor-move select-none"
        onMouseDown={() => setIsDragging(true)}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          {title}
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-0 custom-scrollbar flex flex-col bg-white dark:bg-gray-900">
        {children}
      </div>

      {/* Resize Handle */}
      <div 
        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 opacity-50 hover:opacity-100 transition-opacity"
        onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-500 dark:text-gray-400">
          <path d="M21 15l-6 6M21 9l-12 12" />
        </svg>
      </div>
    </div>
  );
}
