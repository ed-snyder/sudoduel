import React, { useState, useEffect, useRef } from 'react';

interface FitTextProps {
  children: string;
  minFontSize?: number;
  maxFontSize?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/**
 * Simple FitText component that scales text to fit container width.
 * Uses canvas for accurate text measurement.
 */
export function FitText({
  children,
  minFontSize = 9,
  maxFontSize = 14,
  className = '',
  style = {},
  title,
}: FitTextProps) {
  const [fontSize, setFontSize] = useState(maxFontSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCalculated = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !children) return;

    const calculateSize = () => {
      // Get the PARENT container's width (the score box)
      const parent = container.parentElement;
      if (!parent) {
        return;
      }
      
      const parentStyle = window.getComputedStyle(parent);
      const parentWidth = parent.clientWidth;
      const paddingLeft = parseFloat(parentStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(parentStyle.paddingRight) || 0;
      const availableWidth = parentWidth - paddingLeft - paddingRight;

      if (availableWidth <= 0) {
        // Container not ready, retry
        requestAnimationFrame(calculateSize);
        return;
      }

      // Apply text transform if needed (check CSS)
      const containerStyle = window.getComputedStyle(container);
      const textTransform = containerStyle.textTransform;
      let textToMeasure = children;
      if (textTransform === 'uppercase') {
        textToMeasure = children.toUpperCase();
      }

      // Use canvas for accurate text measurement
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      // Use Industry font (the app's font) with weight 500
      const fontFamily = 'Industry, ui-sans-serif, system-ui, sans-serif';
      const fontWeight = '500';
      
      // Get letter-spacing from styles
      const letterSpacing = parseFloat(containerStyle.letterSpacing) || 0;

      // Find the largest font size that fits
      let optimalSize = minFontSize;
      
      for (let size = maxFontSize; size >= minFontSize; size -= 0.5) {
        ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
        const textWidth = ctx.measureText(textToMeasure).width;
        
        // Account for letter spacing
        const spacingWidth = letterSpacing * Math.max(0, textToMeasure.length - 1);
        const totalWidth = textWidth + spacingWidth;
        
        if (totalWidth <= availableWidth) {
          optimalSize = size;
          break;
        }
      }

      setFontSize(optimalSize);
      hasCalculated.current = true;
    };

    // Reset calculation flag when text changes
    hasCalculated.current = false;
    
    // Run after layout is complete
    const timeoutId = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(calculateSize);
      });
    }, 100);

    // Also recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      if (hasCalculated.current) {
        calculateSize();
      }
    });
    
    const parent = container.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [children, minFontSize, maxFontSize]);

  return (
    <div
      ref={containerRef}
      className={className}
      title={title}
      style={{
        ...style,
        fontSize: `${fontSize}px`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        width: '100%',
        fontFamily: 'Industry, ui-sans-serif, system-ui, sans-serif',
        fontWeight: 500,
      }}
    >
      {children}
    </div>
  );
}
