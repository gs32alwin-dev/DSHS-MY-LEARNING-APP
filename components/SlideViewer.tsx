
import React, { useState } from 'react';
import { Slide } from '../types';

interface SlideViewerProps {
  slides: Slide[];
}

const SlideViewer: React.FC<SlideViewerProps> = ({ slides }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const next = () => setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  const prev = () => setCurrentSlide((prev) => Math.max(prev - 0, 0));

  if (!slides.length) return null;

  return (
    <div className="relative w-full aspect-video bg-slate-900 rounded-xl flex flex-col items-center justify-center text-white p-12 overflow-hidden">
      <div className="absolute top-4 left-6 text-slate-400 text-sm font-medium">
        EduSphere Pro | {currentSlide + 1} / {slides.length}
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl animate-fade-in">
        <h2 className="text-4xl font-bold mb-8 text-center text-indigo-400">
          {slides[currentSlide].title}
        </h2>
        <ul className="space-y-4 w-full">
          {slides[currentSlide].content.map((item, idx) => (
            <li key={idx} className="flex items-start text-lg text-slate-200">
              <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 mr-4 flex-shrink-0"></span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute bottom-6 flex space-x-4">
        <button 
          onClick={prev}
          disabled={currentSlide === 0}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <button 
          onClick={next}
          disabled={currentSlide === slides.length - 1}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
};

export default SlideViewer;
