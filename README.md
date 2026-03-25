# 🎬 VideoForge — AI Video Generator CLI

[![npm version](https://img.shields.io/npm/v/videoforge)](https://www.npmjs.com/package/videoforge)
[![CI](https://github.com/magicpro97/videoforge/actions/workflows/ci.yml/badge.svg)](https://github.com/magicpro97/videoforge/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Multi-provider AI video generation from your terminal.

- **5 Providers**: Runway, fal.ai, Replicate, Google Veo, OpenAI Sora
- **Text-to-Video**: Generate videos from text prompts
- **Image-to-Video**: Animate still images into video clips
- **15 Style Presets**: cinematic, animation, vfx, anime, pixel-art, glitch...
- **11 Resolution Presets**: 480p → 4K, phone, tiktok, youtube, story...
- **Batch Processing**: Generate multiple videos from YAML config
- **Templates**: Save prompts with `{variables}` for repeatable generation
- **Cost Tracking**: Per-provider spending summaries
- **History**: Full generation log with search

## Quick Start

```bash
npm install -g videoforge

# Configure a provider
videoforge config set runway.apiKey "your-key"

# Generate a video
videoforge gen "a cat walking across a sunlit room"

# Generate with a style preset
videoforge gen "ocean waves crashing" --preset cinematic --resolution 1080p

# Animate an image
videoforge animate input.png "zoom in slowly with parallax"

# Compare providers
videoforge compare "a rocket launching into space"
```

## Commands

### Generate Video

```bash
videoforge generate <prompt>          # (alias: gen, g)
  -p, --provider <name>              # runway, fal, replicate, veo, sora
  -m, --model <model>                # Specific model
  -d, --duration <seconds>           # Video duration
  -R, --resolution <preset>          # 480p, 720p, 1080p, 4k, phone, tiktok...
  -f, --fps <number>                 # Frames per second
  --format <type>                    # mp4, webm (default: mp4)
  -n, --count <N>                    # Number of videos
  -s, --preset <style>               # Style preset
  -t, --template <name>              # Use saved prompt template
  -v, --var <key=value>              # Template variable (repeatable)
  --negative <prompt>                # Negative prompt
  --seed <number>                    # Seed for reproducibility
  --quality <1-100>                  # Quality (default: 80)
  -o, --output <path>                # Output file path
  --open                             # Open video after generation
```

### Animate Image

```bash
videoforge animate <image> [prompt]   # (alias: anim, a)
  -p, --provider <name>              # Provider to use
  -d, --duration <seconds>           # Video duration
  -R, --resolution <preset>          # Resolution preset
  --format <type>                    # Output format
  -o, --output <path>                # Output file path
  --open                             # Open after generation
```

### Other Commands

```bash
videoforge compare <prompt>           # Compare across providers
videoforge batch <file.yaml>          # Batch generate from YAML/JSON
videoforge convert <input> --to webm  # Convert format (requires ffmpeg)
videoforge providers list             # List all providers
videoforge history list               # View generation history
videoforge template save <n> <p>      # Save prompt template
videoforge cost summary               # Spending summary
videoforge cost pricing               # Per-provider pricing
videoforge config set <key> <val>     # Set configuration
videoforge config list                # Show all config
```

## Providers

| Provider | Models | Capabilities | API Key |
|----------|--------|--------------|---------|
| **Runway** | gen4, gen3a_turbo | Text-to-Video, Image-to-Video | `runway.apiKey` |
| **fal.ai** | minimax-video, kling-video | Text-to-Video, Image-to-Video | `fal.apiKey` |
| **Replicate** | wan-2.1, ltx-video | Text-to-Video, Variations | `replicate.apiKey` |
| **Google Veo** | veo-2.0-generate | Text-to-Video | `veo.apiKey` |
| **OpenAI Sora** | sora | Text-to-Video | `sora.apiKey` |

### Setup

```bash
videoforge config set runway.apiKey "your-runway-key"
videoforge config set fal.apiKey "your-fal-key"
videoforge config set replicate.apiKey "your-replicate-key"
videoforge config set veo.apiKey "your-veo-key"
videoforge config set sora.apiKey "your-sora-key"
```

## Style Presets

| Preset | Description |
|--------|-------------|
| `cinematic` | Dramatic lighting, film grain, professional color grading |
| `animation` | Smooth 2D/3D animation, vibrant colors, fluid motion |
| `vfx` | Visual effects, particles, explosions, CGI quality |
| `product-demo` | Clean, professional product showcase |
| `social-media` | Fast-paced, attention-grabbing, vertical format |
| `game-trailer` | Intense, action-packed, epic scale |
| `explainer` | Clear, educational, step-by-step graphics |
| `ambient` | Slow, atmospheric, mood-setting |
| `pixel-art` | Retro pixel animation, 8-bit style |
| `anime` | Japanese anime style, dynamic poses |
| `3d-render` | Photorealistic 3D rendering, ray tracing |
| `timelapse` | Accelerated time passage, smooth transitions |
| `glitch` | Digital glitch, cyberpunk aesthetic, neon |
| `minimal` | Clean minimalist motion graphics |
| `watercolor` | Artistic watercolor paint style |

## Resolution Presets

| Preset | Resolution | Use Case |
|--------|-----------|----------|
| `480p` | 854×480 | SD preview |
| `720p` | 1280×720 | HD |
| `1080p` | 1920×1080 | Full HD |
| `4k` | 3840×2160 | Ultra HD |
| `phone` | 1080×1920 | Mobile (9:16) |
| `square` | 1080×1080 | Instagram (1:1) |
| `youtube` | 1920×1080 | YouTube (16:9) |
| `tiktok` | 1080×1920 | TikTok (9:16) |
| `story` | 1080×1920 | Stories (9:16) |
| `og-video` | 1200×630 | Open Graph |
| `tablet` | 1024×1366 | Tablet (3:4) |

## Batch Processing

Create a YAML file:

```yaml
items:
  - prompt: "ocean waves at sunset"
    provider: runway
    duration: 5
    preset: cinematic
  - prompt: "neon city streets at night"
    provider: fal
    resolution: 1080p
```

```bash
videoforge batch videos.yaml
videoforge batch videos.yaml --dry-run  # Preview only
```

## Templates

```bash
# Save a template with variables
videoforge template save product-shot "{product} rotating on {background} background" --preset product-demo

# Use the template
videoforge gen "" -t product-shot -v product=sneaker -v background=white

# List and manage
videoforge template list
videoforge template show product-shot
videoforge template delete product-shot
```

## Format Conversion

Requires `ffmpeg` installed locally:

```bash
videoforge convert video.mp4 --to webm
videoforge convert video.mp4 --to gif
videoforge convert video.webm --to mp4
```

## Part of the Forge Ecosystem

| Tool | Purpose |
|------|---------|
| [AppForge](https://github.com/magicpro97/appforge) | Scaffold projects |
| [BackForge](https://github.com/magicpro97/backforge) | Backend init |
| [TestForge](https://github.com/magicpro97/testforge) | AI test generation |
| [ImgForge](https://github.com/magicpro97/imgforge) | AI image generation |
| [AudioForge](https://github.com/magicpro97/audioforge) | AI audio generation |
| **VideoForge** | **AI video generation** |
| [ScreenForge](https://github.com/magicpro97/screenforge) | App store assets |
| [StoreForge](https://github.com/magicpro97/storeforge) | Store deployment |
| [MonForge](https://github.com/magicpro97/monforge) | Production monitoring |

## License

MIT © [magicpro97](https://github.com/magicpro97)
