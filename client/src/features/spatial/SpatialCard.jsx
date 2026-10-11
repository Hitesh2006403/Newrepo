import React, { useState, useRef, useEffect } from 'react';

/**
 * SpatialCard
 * An interactive 3D perspective tilt card that responds smoothly to mouse movement
 * with subtle specular lighting, depth elevation, and tactile physics.
 * Automatically respects reduced-motion preferences.
 */
export const SpatialCard = ({
  children,
  className = '',
  maxTilt = 8,
  glare = true,
  elevation = true,
  interactive = true,
  onClick,
}) => {
  const cardRef = useRef(null);
  const [transform, setTransform] = useState('');
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50, opacity: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  const handleMouseMove = (e) => {
    if (!interactive || prefersReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    setTransform(
      `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) ${
        elevation ? 'translateZ(6px) scale3d(1.01, 1.01, 1.01)' : ''
      }`
    );

    if (glare) {
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;
      setGlarePosition({ x: glareX, y: glareY, opacity: 0.15 });
    }
  };

  const handleMouseLeave = () => {
    if (!interactive || prefersReducedMotion) return;
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale3d(1, 1, 1)');
    setGlarePosition((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: transform || undefined,
        transformStyle: 'preserve-3d',
        transition: transform ? 'transform 0.08s ease-out' : 'transform 0.35s ease-out',
        willChange: 'transform',
      }}
      className={`relative transition-shadow duration-300 ${
        interactive ? 'cursor-pointer hover:shadow-xl dark:hover:shadow-rose-950/20' : ''
      } ${className}`}
    >
      {children}

      {/* Dynamic Specular Glare Reflection */}
      {glare && !prefersReducedMotion && (
        <div
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle at ${glarePosition.x}% ${glarePosition.y}%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 65%)`,
            opacity: glarePosition.opacity,
            transition: 'opacity 0.25s ease-out',
          }}
          className="pointer-events-none absolute inset-0 rounded-2xl z-20"
        />
      )}
    </div>
  );
};

export default SpatialCard;
