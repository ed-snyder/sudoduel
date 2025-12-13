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

  const calculateFontSize = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    // Get container's available width (accounting for padding)
    const containerStyle = window.getComputedStyle(container);
    const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(containerStyle.paddingRight) || 0;
    const availableWidth = container.offsetWidth - paddingLeft - paddingRight;

    if (availableWidth <= 0) return;

    // Start with max and reduce until it fits
    let currentSize = maxFontSize;
    textEl.style.fontSize = `${currentSize}px`;

    while (textEl.scrollWidth > availableWidth && currentSize > minFontSize) {
      currentSize -= 1;
      textEl.style.fontSize = `${currentSize}px`;
    }

    setFontSize(currentSize);
  }, [children, minFontSize, maxFontSize]);

  useEffect(() => {
    // Initial calculation
    calculateFontSize();

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      calculateFontSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
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
        ref={textRef}
        style={{
          fontSize: `${fontSize}px`,
          display: 'inline-block',
        }}
      >
        {children}
      </span>
    </Component>
  );
}
