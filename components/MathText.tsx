
import React, { useEffect, useRef } from 'react';

interface Props {
  text: string;
  className?: string;
}

/**
 * Komponen untuk merender teks yang mengandung notasi LaTeX.
 * Mendukung inline: $E=mc^2$ dan block: $$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$
 */
const MathText: React.FC<Props> = ({ text, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && window.renderMathInElement) {
      window.renderMathInElement(containerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    }
  }, [text]);

  return (
    <div 
      ref={containerRef} 
      className={className}
      style={{ wordBreak: 'break-word' }}
    >
      {text}
    </div>
  );
};

export default MathText;

declare global {
  interface Window {
    renderMathInElement: (el: HTMLElement, options: any) => void;
  }
}
