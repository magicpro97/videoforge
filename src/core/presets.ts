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
};

export function applyPreset(prompt: string, presetName: string): string {
  const suffix = STYLE_PRESETS[presetName];
  if (!suffix) return prompt;
  return `${prompt}, ${suffix}`;
}

export function getPresetNames(): string[] {
  return Object.keys(STYLE_PRESETS);
}
