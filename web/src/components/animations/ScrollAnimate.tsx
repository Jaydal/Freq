"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type AnimationType = "fade-up" | "fade-in" | "slide-in-left" | "slide-in-right" | "scale-in";

interface ScrollAnimateProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
  threshold?: number;
}

export function ScrollAnimate({
  children,
  animation = "fade-up",
  delay = 0,
  duration = 600,
  className = "",
  threshold = 0.15,
}: ScrollAnimateProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  const base: Record<AnimationType, string> = {
    "fade-up": "translate-y-8",
    "fade-in": "translate-y-0",
    "slide-in-left": "-translate-x-8",
    "slide-in-right": "translate-x-8",
    "scale-in": "scale-95",
  };

  const hiddenState = `opacity-0 ${base[animation]}`;
  const visibleState = "opacity-100 translate-y-0 translate-x-0 scale-100";

  return (
    <div
      ref={ref}
      className={[
        "transition-all",
        isVisible ? visibleState : hiddenState,
        className,
      ].join(" ")}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}
