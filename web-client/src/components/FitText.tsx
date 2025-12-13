import React, { useState, useEffect, useRef, useCallback } from 'react';

interface FitTextProps {
  children: string;
  minFontSize?: number;
  maxFontSize?: number;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
  title?: string;
}

/**
 * Component that automatically fits text within its container
 */
export function FitText({
  children,
  minFontSize = 10,
  maxFontSize = 24,
  className = '',
  style = {},
  as: Component = 'span',
  title,
}: FitTextProps) {
  const [fontSize, setFontSize] = useState(maxFontSize);
  const containerRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);

  const calculateFontSize = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    
    if (!container || !textEl || !children) {
      return;
    }

    // Get container's available width
    const containerStyle = window.getComputedStyle(container);
    const containerWidth = container.offsetWidth;
    const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(containerStyle.paddingRight) || 0;
    const availableWidth = containerWidth - paddingLeft - paddingRight;

    if (availableWidth <= 0 || containerWidth === 0) {
      // Retry after a short delay if container not ready
      requestAnimationFrame(() => {
        setTimeout(() => calculateFontSize(), 100);
      });
      return;
    }

    // Create hidden measurement element if it doesn't exist
    if (!measureRef.current) {
      const span = document.createElement('span');
      span.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: nowrap;
        pointer-events: none;
        top: -9999px;
        left: -9999px;
      `;
      document.body.appendChild(span);
      measureRef.current = span;
    }

    const measureSpan = measureRef.current;

    // Copy all font-related styles from container to measurement element
    measureSpan.style.fontFamily = containerStyle.fontFamily || 'inherit';
    measureSpan.style.fontWeight = containerStyle.fontWeight || 'normal';
    measureSpan.style.fontStyle = containerStyle.fontStyle || 'normal';
    measureSpan.style.letterSpacing = containerStyle.letterSpacing || 'normal';
    measureSpan.style.textTransform = containerStyle.textTransform || 'none';
    measureSpan.style.textDecoration = containerStyle.textDecoration || 'none';
    measureSpan.textContent = children;

    // Binary search for optimal font size
    let low = minFontSize;
    let high = maxFontSize;
    let optimalSize = minFontSize;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      measureSpan.style.fontSize = `${mid}px`;
      
      // Force reflow
      void measureSpan.offsetWidth;
      
      const textWidth = measureSpan.offsetWidth;
      
      if (textWidth <= availableWidth) {
        optimalSize = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    // Ensure we don't go below minFontSize
    optimalSize = Math.max(optimalSize, minFontSize);
    
    // Only update if changed to avoid unnecessary re-renders
    if (optimalSize !== fontSize) {
      setFontSize(optimalSize);
    }
  }, [children, minFontSize, maxFontSize, fontSize]);

  useEffect(() => {
    // Initial calculation - use requestAnimationFrame to ensure DOM is ready
    let rafId: number;
    const timeoutId = setTimeout(() => {
      rafId = requestAnimationFrame(() => {
        calculateFontSize();
      });
    }, 0);

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        calculateFontSize();
      });
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      // Cleanup measurement element
      if (measureRef.current) {
        measureRef.current.remove();
        measureRef.current = null;
      }
    };
  }, [calculateFontSize]);

  // Recalculate when text changes
  useEffect(() => {
    calculateFontSize();
  }, [children, calculateFontSize]);

  return (
    <Component
      ref={containerRef as any}
      className={className}
      style={{
        ...style,
        display: 'block',
        width: '100%',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
      title={title}
    >
      <span
        ref={textRef}
        style={{
          fontSize: `${fontSize}px`,
          display: 'inline-block',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </Component>
  );
}
