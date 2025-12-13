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
  const measureRef = useRef<HTMLSpanElement | null>(null);

  const calculateFontSize = useCallback(() => {
    const container = containerRef.current;
    if (!container || !children) return;

    // Get container's available width (accounting for padding)
    const containerStyle = window.getComputedStyle(container);
    const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(containerStyle.paddingRight) || 0;
    const availableWidth = container.offsetWidth - paddingLeft - paddingRight;

    if (availableWidth <= 0) return;

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
    measureSpan.style.fontFamily = containerStyle.fontFamily;
    measureSpan.style.fontWeight = containerStyle.fontWeight;
    measureSpan.style.fontStyle = containerStyle.fontStyle;
    measureSpan.style.letterSpacing = containerStyle.letterSpacing;
    measureSpan.style.textTransform = containerStyle.textTransform;
    measureSpan.style.textDecoration = containerStyle.textDecoration;
    measureSpan.textContent = children;

    // Binary search for optimal font size
    let low = minFontSize;
    let high = maxFontSize;
    let optimalSize = minFontSize;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      measureSpan.style.fontSize = `${mid}px`;
      
      // Force reflow
      measureSpan.offsetWidth;
      
      if (measureSpan.offsetWidth <= availableWidth) {
        optimalSize = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    setFontSize(optimalSize);
  }, [children, minFontSize, maxFontSize]);

  useEffect(() => {
    // Initial calculation with a small delay to ensure container is rendered
    const timeoutId = setTimeout(() => {
      calculateFontSize();
    }, 0);

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      calculateFontSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
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
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
      title={title}
    >
      <span
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
