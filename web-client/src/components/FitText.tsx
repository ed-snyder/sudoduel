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
  const retryTimeoutRef = useRef<number | null>(null);

  const calculateFontSize = useCallback(() => {
    const container = containerRef.current;
    if (!container || !children) return;

    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Get the parent container's width (the score box div)
    const parent = container.parentElement;
    if (!parent) {
      // If no parent, try again after a delay
      if (!retryTimeoutRef.current) {
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          calculateFontSize();
        }, 100);
      }
      return;
    }

    const parentStyle = window.getComputedStyle(parent);
    const parentWidth = parent.offsetWidth;
    const parentPaddingLeft = parseFloat(parentStyle.paddingLeft) || 0;
    const parentPaddingRight = parseFloat(parentStyle.paddingRight) || 0;
    const availableWidth = parentWidth - parentPaddingLeft - parentPaddingRight;

    if (availableWidth <= 0) {
      // If container not ready, try again after a short delay
      if (!retryTimeoutRef.current) {
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          calculateFontSize();
        }, 100);
      }
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
    const containerStyle = window.getComputedStyle(container);
    measureSpan.style.fontFamily = containerStyle.fontFamily || 'inherit';
    measureSpan.style.fontWeight = containerStyle.fontWeight || 'normal';
    measureSpan.style.fontStyle = containerStyle.fontStyle || 'normal';
    measureSpan.style.letterSpacing = containerStyle.letterSpacing || 'normal';
    measureSpan.style.textTransform = containerStyle.textTransform || 'none';
    measureSpan.style.textDecoration = containerStyle.textDecoration || 'none';
    measureSpan.style.fontSize = `${maxFontSize}px`; // Start with max
    measureSpan.textContent = children;

    // Start from max and work down until it fits
    let optimalSize = maxFontSize;
    measureSpan.style.fontSize = `${optimalSize}px`;
    
    // Force reflow
    void measureSpan.offsetWidth;
    
    // If it doesn't fit, reduce font size
    while (measureSpan.offsetWidth > availableWidth && optimalSize > minFontSize) {
      optimalSize -= 0.5; // Use smaller increments for better fit
      measureSpan.style.fontSize = `${optimalSize}px`;
      void measureSpan.offsetWidth;
    }
    
    // Round to nearest integer
    optimalSize = Math.max(Math.round(optimalSize), minFontSize);
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
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
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
        style={{
          fontSize: `${fontSize}px`,
          display: 'inline-block',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        {children}
      </span>
    </Component>
  );
}
