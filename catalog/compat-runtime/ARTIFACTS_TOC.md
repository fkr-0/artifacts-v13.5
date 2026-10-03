# ARTIFACTS COLLECTION - Table of Contents

> Collection of artifacts from the wrong side of the tracks — projects not yet grown to their own repo.

**Last Updated:** 2026-05-04

---

## 📁 PROJECT DIRECTORIES

### 🎨 SPC - Sharepic Creator Suite
**Path:** `spc/`

Template generation artifacts — sharepic creators, themers, palette generation, procedural UI tools.

| Artifact | Description | Type |
|----------|-------------|-----|
| `sharepic-studio-ultimate.html` | ⭐ **ULTIMATE** - Merged version with all features | HTML/JS |
| `aether_node.html` | Aether node visualizer | HTML/JS |
| `procedural_sharepic_studio.html` | Procedural sharepic generation (SPC Pro) | HTML/JS |
| `sharepic_studio.html` | Sharepic creation studio (duplicate of above) | HTML/JS |
| `template_engine.html` | Template rendering engine | HTML/JS |
| `templateengine.html` | Template engine variant | HTML/JS |

**Status:** ✅ **COMPLETE** - sharepic-studio-ultimate.html created (2026-05-04)
- Merged features from root and SPC versions
- 9 themes, 14 generators, 6 new adjustment sliders
- Rich text engine, smart layouts, export presets
- **NEW:** Full LaTeX math support via MathJax 3
- **NEW:** Math toolbar with 20 quick-insert buttons
- **NEW:** Canvas-ready LaTeX rendering for export

---

### 🥊 BRAWL - Ethic Brawl
**Path:** `brawl/ethic-brawl/`

A 2.5D cyberpunk philosophical arena-brawler with absurdist humor. Battle as neon-cyberpunk versions of historical philosophers.

**Technology:** TypeScript + Vite + Canvas + Web Audio API

**Characters:**
- Albert Camus - "The Absurdist" (Balanced, resilience)
- Gottfried Leibniz - "The Optimist" (Technical, projectiles)
- Niccolò Machiavelli - "The Strategist" (Aggressive, counters)
- Diogenes - "The Cynic" (Defensive tank, disruption)

**Features:**
- Fixed timestep physics (60fps)
- State machine architecture
- Event-driven systems
- Procedural audio synthesis

**Next Works:**
- Network multiplayer (WebSocket)
- Expanded character roster
- Environmental hazards
- Story mode expansion

**Docs:** ARCHITECTURE_SPEC.md, DESIGN_SPEC.md, IMPLEMENTATION_PLAN.md

---

### 🎵 PEERNET-ORCA - Groove Station
**Path:** `peernet-orca/`

**P2P Collaborative Music Studio** — browser-based peer-to-peer music production environment.

**Features:**
- P2P distributed (PeerJS WebRTC, no server)
- Collaborative lobbies
- Transport with BPM, metronome, bars
- Sound generators (Sampler, Rack, Basic Synth)
- Piano roll sequencer (16th note grid)
- Mixer with VU meters, mute/solo
- Effects rack (Delay, Reverb, Flanger, Looper)

**Files:**
- `index.html` (29KB) - Main app with CSS
- `app.js` (101KB) - Audio engine, UI, P2P
- `peernet.js` (244KB) - PeerNet library

---

### 🌐 PEERNETJS - Peer.js Tooling
**Path:** `peernetjs/`

Peer.js tooling library and sample applications.

**Status:** Early stage — minimal documentation

---

### 🚽 BATHROOM EMERGENCY GUIDE v3.2
**Path:** `bathroom-emergency-guide/`

Modular, revisionable, re-buildable decision-support document for bathroom environments.

**Features (v3.2):**
- 21 mathematical formulas across 7 chapters
- LaTeX math notation (MathJax HTML, Pandoc native)
- 40+ Pandoc footnotes with source citations
- 14 scientific diagrams (pixel art aesthetic)
- Per-chapter versioning
- Multi-format output (HTML, PDF, LaTeX, DOCX)

**Chapters:**
1. Cover & How to Use
2. Situation A (acute issues)
3. Situations B-G (anxiety, pain, etc.)
4. Calm Guide (breathing techniques)
5. Self-Ambulance (vital signs)
6. Zombie Guide (survival probability)
7. Professional Support
8. Appendix (formula index)

**Build Tools:**
- Python diagram generators
- Pandoc format conversion
- WeasyPrint PDF rendering

---

### ⚡ ASTERA RELAY IDENTITY - Nightline Configurable
**Path:** `aster-relay-identity-nightline-configurable/`

Identity/branding configuration system.

**Structure:**
- `manifest.json` - Configuration manifest
- `templates/` - Brand templates
- `assets/` - Brand assets
- `samples/` - Sample configurations
- `generated/` - Generated outputs
- `scripts/` - Build scripts

---

### 🚀 APP-HUB - NEXUS Console Interface
**Path:** `app-hub/`

Sci-fi spaceship interface for indexing all artifacts.

**Versions:**
| Version | Title | Features |
|---------|-------|----------|
| v1-v3 | HYPERSPACE TERMINAL | Early NEXUS console |
| v4 | NEXUS CONSOLE | Refined interface |
| v5 | FIELD RECORDER | Field recording variant |
| v6 | FIELD RECORDER v3 | Enhanced recording |
| v7 | Field Recorder v4 | Tested version |
| **index.html** | **NEXUS Console v2.4.7** | **Current flagship** |

**NEXUS Console Features:**
- 6 themes: TRON, Synthwave, Cyberpunk, 8-Bit Retro, Midnight Blue, Vaporwave
- Particle systems with animated grid
- Scanlines effect
- Sound effects (Web Audio API)
- Theme switching
- Multiple panels: Artifacts, Settings, Log
- Artifact cards by category
- Config modal for parameters

**NEW: v8 Portal + Collaborative Editors (2026-05-04):**
- `v8-portal.html` - Enhanced artifact navigator with starfield + warp effects
- `collab-editor.html` - Monaco-based collaborative code editor
- `collab-editor-lite.html` - Lightweight collaborative text editor

**NEW: v9 Portal - Embedded Apps + P2P (2026-05-04):**
- `v9-portal.html` - Next-generation portal with embedded apps and native P2P
- **Tag-based filtering** instead of categories (click to enable, multi-select)
- **Embedded apps** that render directly without external loading:
  - Hyperblast Shooter game (canvas-based)
  - Quick Notepad with localStorage persistence
  - Sci-Fi Calculator
  - Color Picker with palette history
- **Standalone classic games exposed through v9/v10:**
  - `minesweeper/index.html` - Original-style Minesweeper with Beginner, Intermediate, Expert, custom boards, timer scoring, flags, chording, and local best times
  - `solitaire/index.html` - Klondike Solitaire clone with draw-one/draw-three, tableau/foundation moves, scoring, undo, timer, auto-foundation helper, and local best score
- **Native P2P panel** (bottom left) showing all connected users
- Username setting with random ID generation
- Real-time connected users list with color-coded cursors
- PeerJS/WebRTC for P2P coordination

**v4 Console Deep Links:**
- `v4.html#app:shooter` - Hyperblast Space Shooter
- `v4.html#app:synth` - WaveSynth Modular
- `v4.html#app:fieldrec` - Field Recorder

---

## 📄 ROOT-LEVEL ARTIFACTS

| File | Description | Type |
|------|-------------|------|
| `answer.html` | Interactive Q&A page | HTML |
| `font_lab_browser.html` | Font laboratory browser | HTML/JS |
| `index_multitext.html` | Multi-text index | HTML |
| `procedural-sharepic-studio.html` | Sharepic studio (root duplicate) | HTML/JS |
| `sexy-love-chat/index.html` | Chat interface | HTML/JS |
| `viewer_advanced.html` | Advanced viewer | HTML/JS |
| `deep-research-report.md` | Research findings | Markdown |

**Escape Collective Series:**
- `escape-collective-onepager.html` - One-pager
- `escape-collective-sponsor.css` - Sponsor styles
- `escape-collective-template-generator*.html` - Multiple template generator versions
- `escape-collective-template.png` - Template preview

**Archives:**
- Multiple `.tar` and `.tar.gz` workspace backups
- Various project zips

---

## 🎯 NEXT WORKS PRIORITIES

### High Priority
1. **APP-HUB ENHANCEMENT** - Extend NEXUS Console with actual artifact linking
   - Add real artifact data from this TOC
   - Implement actual navigation to projects
   - Add version history display
   - Integrate with spc/ versions

2. **SPC CONSOLIDATION** - Survey and bundle sharepic tools
   - Compare versions in spc/
   - Identify best-of-breed features
   - Create unified tool

3. **BRAWL EXTENSIONS** - Complete Ethic Brawl features
   - Network multiplayer
   - Additional philosophers
   - Story mode content

### Medium Priority
4. **PEERNETJS DOCUMENTATION** - Add API docs and examples
5. **BATHROOM GUIDE v4** - Scientific formula expansion
6. **ASTER RELAY** - Template system expansion

---

## 📊 PROJECT STATUS SUMMARY

| Project | Status | Completeness |
|---------|--------|--------------|
| spc/ | Survey needed | Mixed versions |
| brawl/ | In development | Core complete, expansions planned |
| peernet-orca/ | Functional | Feature-complete |
| peernetjs/ | Early stage | Needs documentation |
| bathroom-emergency-guide/ | Mature v3.2 | Production-ready |
| aster-relay/ | Functional | Template system |
| app-hub/ | Enhancement phase | v2.4.7 flagship |

---

*Generated automatically from artifacts directory structure*

---

### 📷 OVERLAY CAM
**Path:** `overlay-cam/`

Android debug APK for a camera freeze, image overlay, adjustment, and save workflow.

- `index.html` — download page
- `overlay-cam-intuitive-ux-debug.apk` — verified debug APK
