import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Sequence,
} from 'remotion';

// ========== النظام الديناميكي الكامل ==========

export const UniversalComponent = (props) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ========== استخراج البروبس مع قيم افتراضية ==========
  const {
    // المحتوى
    title = '',
    subtitle = '',
    text = '',
    items = [],
    
    // التصميم
    template = 'modern',       // modern, minimal, bold, gradient, glass, neon
    theme = 'dark',            // dark, light, colorful
    animation = 'spring',     // spring, fade, slide, scale, typewriter, bounce
    direction = 'ltr',        // ltr, rtl
    
    // الألوان
    bgColor = '#0a192f',
    bgGradient = '',          // 'linear-gradient(135deg, #667eea, #764ba2)'
    accentColor = '#64ffda',
    textColor = '#ffffff',
    secondaryColor = '#8892b0',
    
    // الفونت
    fontFamily = 'Arial',
    fontUrl = '',
    fontWeight = '700',
    titleSize = 80,
    subtitleSize = 40,
    textSize = 28,
    
    // المؤثرات
    glow = true,
    shadow = true,
    particles = true,
    progressBar = true,
    blur = 0,
    
    // التخطيط
    layout = 'center',        // center, top, bottom, left, right, split
    spacing = 20,
    padding = 60,
    
    // الحركة
    duration = 5,
    delay = 0,
    speed = 1,
    
    // متقدم
    customCSS = '',
    customJS = '',
    
  } = props;

  // ========== نظام القوالب ==========
  const templates = {
    modern: {
      bg: 'linear-gradient(135deg, #0a192f 0%, #1a365d 100%)',
      font: 'Poppins',
      accent: '#64ffda',
      style: 'sans-serif',
    },
    minimal: {
      bg: '#ffffff',
      font: 'Inter',
      accent: '#000000',
      style: 'sans-serif',
    },
    bold: {
      bg: '#ff6b6b',
      font: 'Bebas Neue',
      accent: '#ffffff',
      style: 'display',
    },
    gradient: {
      bg: 'linear-gradient(45deg, #667eea, #764ba2, #f093fb)',
      font: 'Montserrat',
      accent: '#ffffff',
      style: 'sans-serif',
    },
    glass: {
      bg: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
      font: 'SF Pro Display',
      accent: '#ffffff',
      style: 'sans-serif',
    },
    neon: {
      bg: '#0a0a0a',
      font: 'Orbitron',
      accent: '#00ff88',
      style: 'display',
    },
  };

  // ========== تطبيق القالب ==========
  const activeTemplate = templates[template] || templates.modern;
  const finalBg = bgGradient || activeTemplate.bg || bgColor;
  const finalFont = fontUrl ? 'CustomFont' : (fontFamily || activeTemplate.font);
  const finalAccent = accentColor || activeTemplate.accent;
  const finalTextColor = textColor || (theme === 'light' ? '#000000' : '#ffffff');

  // ========== نظام الحركات ==========
  const getAnimation = (type, frame, fps, delay = 0) => {
    const f = Math.max(0, frame - delay);
    
    const animations = {
      spring: spring({ frame: f, fps, config: { damping: 15, stiffness: 100 } }),
      fade: interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' }),
      slide: interpolate(f, [0, 20], [50, 0], { extrapolateRight: 'clamp' }),
      scale: interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
      typewriter: Math.min(1, f / (text.length * 2)),
      bounce: spring({ frame: f, fps, config: { damping: 8, stiffness: 150 } }),
    };
    
    return animations[type] || animations.spring;
  };

  const animValue = getAnimation(animation, frame, fps, delay);

  // ========== نظام الألوان التلقائي ==========
  const isLight = theme === 'light' || template === 'minimal';
  const bgLuminance = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';

  // ========== توليد الجسيمات ==========
  const ParticleSystem = () => {
    if (!particles) return null;
    
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        {Array.from({ length: 20 }, (_, i) => {
          const x = (Math.sin(frame * 0.02 + i * 1.5) + 1) * 50;
          const y = (Math.cos(frame * 0.015 + i * 2) + 1) * 50;
          const size = 2 + Math.sin(i) * 3;
          const opacity = 0.1 + Math.sin(frame * 0.03 + i) * 0.2;
          
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: size,
                height: size,
                borderRadius: '50%',
                backgroundColor: finalAccent,
                opacity,
                filter: 'blur(1px)',
              }}
            />
          );
        })}
      </div>
    );
  };

  // ========== شريط التقدم ==========
  const ProgressBar = () => {
    if (!progressBar) return null;
    
    const progress = frame / durationInFrames;
    
    return (
      <div style={{
        position: 'absolute',
        bottom: 40,
        left: '10%',
        right: '10%',
        height: 3,
        backgroundColor: isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress * 100}%`,
          backgroundColor: finalAccent,
          borderRadius: 2,
          boxShadow: glow ? `0 0 10px ${finalAccent}` : 'none',
          transition: 'width 0.1s linear',
        }} />
      </div>
    );
  };

  // ========== نظام التخطيط ==========
  const getLayout = () => {
    const layouts = {
      center: { alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
      top: { alignItems: 'center', justifyContent: 'flex-start', textAlign: 'center', paddingTop: 80 },
      bottom: { alignItems: 'center', justifyContent: 'flex-end', textAlign: 'center', paddingBottom: 100 },
      left: { alignItems: 'flex-start', justifyContent: 'center', textAlign: 'left', paddingLeft: 80 },
      right: { alignItems: 'flex-end', justifyContent: 'center', textAlign: 'right', paddingRight: 80 },
      split: { alignItems: 'flex-start', justifyContent: 'center', textAlign: 'left' },
    };
    
    return layouts[layout] || layouts.center;
  };

  const layoutStyle = getLayout();
  const dir = direction === 'rtl' ? 'rtl' : 'ltr';

  // ========== تأثير الزجاج ==========
  const GlassEffect = ({ children }) => {
    if (template !== 'glass') return children;
    
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: '1px solid rgba(255, 255, 255, 0.2)',
        padding: 40,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      }}>
        {children}
      </div>
    );
  };

  // ========== تأثير النيون ==========
  const NeonEffect = ({ children }) => {
    if (template !== 'neon') return children;
    
    return (
      <div style={{
        filter: `drop-shadow(0 0 10px ${finalAccent}) drop-shadow(0 0 20px ${finalAccent})`,
      }}>
        {children}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{
      background: finalBg,
      fontFamily: finalFont,
      direction: dir,
      ...layoutStyle,
      padding,
      overflow: 'hidden',
    }}>
      {/* ========== CSS مخصص ========== */}
      {fontUrl && (
        <style>{`
          @font-face {
            font-family: 'CustomFont';
            src: url('${fontUrl}') format('truetype');
          }
        `}</style>
      )}
      {!fontUrl && fontFamily !== 'Arial' && (
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=${finalFont.replace(/ /g, '+')}:wght@400;700;900&display=swap');
        `}</style>
      )}
      {customCSS && <style>{customCSS}</style>}

      {/* ========== الخلفية ========== */}
      <ParticleSystem />

      {/* ========== المحتوى ========== */}
      <div style={{
        zIndex: 1,
        width: '100%',
        maxWidth: 1200,
      }}>
        <GlassEffect>
          <NeonEffect>
            <div style={{
              transform: `scale(${animValue}) translateY(${(1 - animValue) * 30}px)`,
              opacity: animValue,
              filter: blur ? `blur(${blur}px)` : 'none',
            }}>
              {/* ========== العنوان ========== */}
              {title && (
                <h1 style={{
                  fontSize: titleSize,
                  fontWeight: fontWeight,
                  color: finalAccent,
                  margin: 0,
                  lineHeight: 1.2,
                  textShadow: shadow ? `0 4px 20px ${finalAccent}44` : 'none',
                  letterSpacing: template === 'bold' ? '0.05em' : 'normal',
                  textTransform: template === 'bold' ? 'uppercase' : 'none',
                }}>
                  {title}
                </h1>
              )}

              {/* ========== العنوان الفرعي ========== */}
              {subtitle && (
                <p style={{
                  fontSize: subtitleSize,
                  fontWeight: '400',
                  color: finalTextColor,
                  margin: `${spacing}px 0 0 0`,
                  opacity: 0.9,
                  lineHeight: 1.5,
                }}>
                  {subtitle}
                </p>
              )}

              {/* ========== النص ========== */}
              {text && (
                <p style={{
                  fontSize: textSize,
                  color: secondaryColor,
                  margin: `${spacing}px 0 0 0`,
                  lineHeight: 1.6,
                  opacity: 0.8,
                }}>
                  {text}
                </p>
              )}

              {/* ========== قائمة العناصر ========== */}
              {items.length > 0 && (
                <div style={{
                  marginTop: spacing * 2,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 15,
                  justifyContent: layout === 'center' ? 'center' : 'flex-start',
                }}>
                  {items.map((item, i) => (
                    <div
                      key={i}
                      style={{
                        opacity: interpolate(frame, [i * 10, i * 10 + 15], [0, 1], { extrapolateRight: 'clamp' }),
                        transform: `translateY(${interpolate(frame, [i * 10, i * 10 + 15], [20, 0], { extrapolateRight: 'clamp' })}px)`,
                        padding: '12px 24px',
                        background: `${finalAccent}15`,
                        border: `1px solid ${finalAccent}33`,
                        borderRadius: 8,
                        color: finalTextColor,
                        fontSize: textSize,
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </NeonEffect>
        </GlassEffect>
      </div>

      {/* ========== شريط التقدم ========== */}
      <ProgressBar />

      {/* ========== عداد الإطارات ========== */}
      {progressBar && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 30,
          color: isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
          fontSize: 12,
          fontFamily: 'monospace',
        }}>
          {frame} / {durationInFrames}
        </div>
      )}
    </AbsoluteFill>
  );
};
