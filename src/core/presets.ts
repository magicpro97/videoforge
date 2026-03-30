export const STYLE_PRESETS: Record<string, string> = {
  'cinematic': 'cinematic quality, dramatic lighting, shallow depth of field, film grain, professional color grading',
  'animation': 'smooth 2D/3D animation, vibrant colors, fluid motion, cartoon style',
  'vfx': 'visual effects, particles, explosions, dynamic lighting, CGI quality',
  'product-demo': 'clean, professional product showcase, minimal background, smooth camera movement',
  'social-media': 'fast-paced, attention-grabbing, bold text overlays, vertical format, trendy',
  'game-trailer': 'intense, action-packed, dramatic music feel, epic scale, game footage style',
  'explainer': 'clear, educational, step-by-step, clean graphics, professional narration style',
  'ambient': 'slow, atmospheric, mood-setting, gentle movement, meditative',
  'pixel-art': 'retro pixel animation, 8-bit style, nostalgic, limited color palette',
  'anime': 'Japanese anime style, dynamic poses, expressive characters, vibrant scenes',
  '3d-render': 'photorealistic 3D rendering, ray tracing, studio lighting, detailed textures',
  'timelapse': 'accelerated time passage, smooth transitions, nature or urban scenes',
  'glitch': 'digital glitch effects, cyberpunk aesthetic, neon colors, distortion',
  'minimal': 'clean, minimalist motion graphics, simple shapes, elegant transitions',
  'watercolor': 'artistic watercolor paint style, soft edges, organic color blending',
  'app-store-preview': 'App store preview video optimized for maximum conversion. 15-30 seconds total length. First 5 seconds must show the app core value proposition immediately. Use clean in-app UI screen recording style footage. Include text caption overlays for silent autoplay viewing (most users watch without sound). Professional smooth transitions between scenes. End with a clear call-to-action screen. Clean, modern, high-quality feel throughout.',
  'intro-demo-cta': 'Three-act video structure: ACT 1 (first 3 seconds) attention-grabbing hook showing the end result or key benefit. ACT 2 (next 15-20 seconds) demonstration of the product in action, showing 3-4 key features with smooth transitions. ACT 3 (final 3-5 seconds) clear call-to-action with logo and download prompt. Pacing should feel natural and confident.',
  'problem-solution': 'Problem-solution narrative video: Open with a relatable pain point or frustration (3-5 seconds). Transition to revealing the solution — your product (2-3 seconds). Show the product solving the problem with 2-3 key interactions (10-15 seconds). Close with the happy outcome and satisfied user, ending on a positive emotional note with CTA (3-5 seconds).',
  'feature-tour': 'Sequential feature showcase video: Each feature gets 3-4 seconds of dedicated screen time. Start with the most impressive feature first. Use clean transitions (fade or slide) between features. Include brief text labels for each feature. Maintain consistent visual style throughout. End with a summary slide showing all features together.',
  'captioned': 'Include prominent text captions and subtitles throughout the entire video. Text should appear in the bottom 20% of the frame on a semi-transparent dark background band. Use white sans-serif font, large enough to read on mobile. Every key action or feature should have a corresponding text caption. Captions should be concise (max 6-8 words per caption). This is essential because most viewers watch without sound in app stores.',
};

export function applyPreset(prompt: string, presetName: string): string {
  const suffix = STYLE_PRESETS[presetName];
  if (!suffix) return prompt;
  return `${prompt}, ${suffix}`;
}

export function getPresetNames(): string[] {
  return Object.keys(STYLE_PRESETS);
}
