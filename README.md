# Echoes // Interactive Creative Engineering Audio Visualizer

**Echoes** is an interactive, real-time audio visualizer utilizing the Web Audio API and HTML5 Canvas. It translates audio frequencies and time-domain signals into dynamic particle rings, colored glow coronas, and raw orbital waveforms.

Live experience is fully self-contained, responsive, and optimized for both desktop viewports and mobile drawer overlays.

---

## 🌟 Key Features

*   **Four Visualizer Engines**:
    *   *Particle Ring*: Central stellar particle field with audio-driven orbital physics and proximity constellation webbing.
    *   *Corona Bars*: Symmetrical radial frequency bars casting colored glow shadows.
    *   *Orbit Wave*: Multi-layered circular oscilloscope plotting time-domain waveforms.
    *   *Nebula Glow*: Deep reactive gradient fluid clouds.
*   **Three Sound Input Modules**:
    *   *Echoes Synth*: Procedural Web Audio API sound generator (16-step electronic drum and melody sequencer with interactive filters) for instant playback out-of-the-box.
    *   *Audio File Loader*: Drag-and-drop or select local audio tracks (`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`).
    *   *Microphone Input*: Real-time environmental sound capture.
*   **Aesthetic Configuration**:
    *   Sleek glassmorphism HUD dashboard.
    *   Responsive, sliding overlay drawers on mobile viewports.
    *   Adjustable physics (particle count, size, glow, sensitivity, temporal smoothing, motion blur).
    *   Theme presets: *Cyberpunk Glow*, *Deep Aurora*, *Solar Flare*, and *Velvet Monochrome*.
*   **Global Shortcuts**:
    *   `Space` -> Play/Pause active source.
    *   `H` -> Toggle HUD visibility (Cinematic Mode).
    *   `F` -> Toggle Fullscreen (Desktop).

---

## 🛠️ Technology Stack

*   **Canvas API**: High-performance 2D context drawing loop.
*   **Web Audio API**: Frequency analysis (`AnalyserNode`), audio routing, and procedural synthesizer generation.
*   **Vanilla JS**: Modular event listeners, scheduling, and mathematical coordinate transformations.
*   **Vanilla CSS**: Pure CSS layout styling, responsive flex/grid layouts, animations, and glassmorphic HUD overlays.

---

## 🚀 How to Run Locally

Since the project uses pure frontend technologies with **zero dependencies**, you can run it instantly:

1. Clone or download this repository.
2. Double-click `index.html` to open it in any modern browser (Chrome, Safari, Firefox, Edge).
3. Click **ENTER EXPERIENCE** to launch.

*Note: Some browser security models restrict local file microphone streaming or cross-origin checks. Running a simple local server is recommended for the best experience. You can run:*
```bash
# Using Node.js npx
npx http-server .
```

---

## 🌐 Deploy to GitHub Pages (Automatic)

Since the app is fully static and client-side, it is perfect for hosting on **GitHub Pages** for free.

### Step 1: Initialize Git and Commit
If you haven't initialized Git yet, run the following in your project folder:
```bash
git init
git add .
git commit -m "Initial commit: Echoes Audio Visualizer ready"
```

### Step 2: Push to GitHub
1. Create a new public repository on GitHub (e.g., `echoes-audio-visualizer`).
2. Link your local project and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub.
2. Click on **Settings** (top tab) -> **Pages** (left menu).
3. Under **Build and deployment**, set the Source to **Deploy from a branch**.
4. Select `main` as the branch and `/ (root)` as the folder.
5. Click **Save**.
6. After 1-2 minutes, GitHub will give you a live URL, e.g., `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`.
