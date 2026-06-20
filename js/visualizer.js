/**
 * E C H O E S // Canvas Rendering Visualizer Engine
 * High-performance 2D canvas drawing logic with particle systems, glow shaders, and radial waveforms.
 */

// Color Palette Definitions
const THEMES = {
    cyberpunk: {
        primary: '#ff0055',
        secondary: '#00ffcc',
        tertiary: '#a800ff',
        quaternary: '#0066ff',
        glow: 'rgba(255, 0, 85, 0.45)',
        bgGlow: 'rgba(255, 0, 85, 0.15)'
    },
    aurora: {
        primary: '#00ffaa',
        secondary: '#0088ff',
        tertiary: '#00ff33',
        quaternary: '#0033aa',
        glow: 'rgba(0, 255, 170, 0.45)',
        bgGlow: 'rgba(0, 255, 170, 0.15)'
    },
    flare: {
        primary: '#ff5500',
        secondary: '#8800ff',
        tertiary: '#ff0055',
        quaternary: '#ffcc00',
        glow: 'rgba(255, 85, 0, 0.45)',
        bgGlow: 'rgba(255, 85, 0, 0.15)'
    },
    mono: {
        primary: '#ffffff',
        secondary: '#888888',
        tertiary: '#dddddd',
        quaternary: '#222222',
        glow: 'rgba(255, 255, 255, 0.35)',
        bgGlow: 'rgba(255, 255, 255, 0.05)'
    }
};

class Particle {
    constructor(canvasWidth, canvasHeight, themeName) {
        this.reset(canvasWidth, canvasHeight, true);
        this.theme = THEMES[themeName] || THEMES.cyberpunk;
    }

    reset(width, height, isInitial = false) {
        // Set radial coordinates
        this.angle = Math.random() * Math.PI * 2;
        
        // Starting radius
        const minDimension = Math.min(width, height);
        this.baseRadius = isInitial 
            ? (Math.random() * 0.2 + 0.15) * minDimension 
            : 0.01 * minDimension; // Start near center if spawned later
            
        this.radius = this.baseRadius;
        this.x = width / 2 + Math.cos(this.angle) * this.radius;
        this.y = height / 2 + Math.sin(this.angle) * this.radius;

        // Speed/Physics parameters
        this.orbitSpeed = (Math.random() * 0.005 + 0.001) * (Math.random() > 0.5 ? 1 : -1);
        this.radialSpeed = Math.random() * 0.5 + 0.2;
        this.size = Math.random() * 2 + 1;
        this.alpha = Math.random() * 0.5 + 0.3;
        
        // Assign frequency index (weight towards lower-mid ranges for cleaner aesthetics)
        this.freqIndex = Math.floor(Math.pow(Math.random(), 1.5) * 180);
        
        // Visual decoration
        this.colorType = Math.random(); // 0: primary, 1: secondary, 2: tertiary
    }

    update(width, height, freqData, sensitivity, loudness, mousePos) {
        const theme = this.theme;
        
        // Grab specific audio value for this particle
        const rawAudioVal = freqData[this.freqIndex] || 0;
        const audioVal = (rawAudioVal / 255) * sensitivity;

        // Radial expansion driven by global loudness + local frequency
        this.orbitSpeed += (audioVal * 0.0005);
        // Cap speed
        const maxSpeed = 0.05;
        this.orbitSpeed = Math.max(-maxSpeed, Math.min(maxSpeed, this.orbitSpeed));
        
        this.angle += this.orbitSpeed;
        
        // Expand outwards with audio response
        const targetRadius = this.baseRadius + (audioVal * 100) + (loudness * 50);
        this.radius += (targetRadius - this.radius) * 0.1; // Smooth interpolation

        // Calculate raw X and Y
        let targetX = width / 2 + Math.cos(this.angle) * this.radius;
        let targetY = height / 2 + Math.sin(this.angle) * this.radius;

        // Mouse interaction: gravitate particles closer or push away based on distance
        if (mousePos.x !== null) {
            const dx = mousePos.x - targetX;
            const dy = mousePos.y - targetY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 150) {
                // Gentle pull towards cursor
                const force = (150 - dist) / 150;
                targetX += (dx / dist) * force * 30;
                targetY += (dy / dist) * force * 30;
            }
        }

        this.x += (targetX - this.x) * 0.15;
        this.y += (targetY - this.y) * 0.15;

        // Size pulses with sound
        this.currentSize = this.size * (1 + audioVal * 1.5);
        this.currentAlpha = Math.min(1.0, this.alpha + audioVal * 0.5);

        // Reset if particle moves outside boundaries
        if (this.radius > Math.max(width, height) * 0.8 || this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
            this.reset(width, height, false);
        }
    }

    draw(ctx, sizeMultiplier) {
        let color = this.theme.primary;
        if (this.colorType > 0.6) color = this.theme.secondary;
        else if (this.colorType > 0.3) color = this.theme.tertiary;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.currentSize * sizeMultiplier, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = this.currentSize * 2;
        ctx.globalAlpha = this.currentAlpha;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow blur immediately
    }
}

class EchoesVisualizer {
    constructor(canvas, analyserNode) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyser = analyserNode;
        
        // Frequencies Setup
        this.bufferLength = this.analyser.frequencyBinCount;
        this.freqData = new Uint8Array(this.bufferLength);
        this.timeData = new Uint8Array(this.bufferLength);

        // Configuration Parameters
        this.visualMode = 'ring'; // 'ring' | 'bars' | 'orbit' | 'nebula'
        this.themeName = 'cyberpunk';
        this.theme = THEMES.cyberpunk;
        
        this.particleCount = 400;
        this.particleSizeMultiplier = 1.0;
        this.glowIntensity = 1.2;
        this.sensitivity = 1.5;
        this.smoothing = 0.82;
        this.motionBlur = true;

        // Mouse tracker
        this.mouse = { x: null, y: null };
        this.setupMouseEvents();

        // Particle System
        this.particles = [];
        this.resize();
        this.initParticles();

        // Loop animation frame ID
        this.animationId = null;
        this.isAnimating = false;

        // Custom parameters
        this.loudness = 0;
        this.bass = 0;
        this.mids = 0;
        this.highs = 0;
    }

    setupMouseEvents() {
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });

        window.addEventListener('click', (e) => {
            this.triggerBurst(e.clientX, e.clientY);
        });
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < 1500; i++) { // Max supported particles pre-initialized
            this.particles.push(new Particle(this.width, this.height, this.themeName));
        }
    }

    triggerBurst(x, y) {
        if (!this.isAnimating) return;
        // Find 40 particles and force reset them at cursor position with high velocities
        let triggered = 0;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (triggered >= 30) break;
            
            // Re-purpose particle for burst
            p.angle = Math.random() * Math.PI * 2;
            p.radius = Math.random() * 10;
            p.x = x;
            p.y = y;
            p.baseRadius = 50;
            p.orbitSpeed = (Math.random() * 0.05 + 0.02) * (Math.random() > 0.5 ? 1 : -1);
            p.size = Math.random() * 3 + 2;
            triggered++;
        }
    }

    setTheme(themeName) {
        if (THEMES[themeName]) {
            this.themeName = themeName;
            this.theme = THEMES[themeName];
            
            // Propagate theme color configurations to all particles
            this.particles.forEach(p => {
                p.theme = this.theme;
            });

            // Set body css variables dynamically for cohesive background glow
            document.documentElement.style.setProperty('--color-primary', this.theme.primary);
            document.documentElement.style.setProperty('--color-secondary', this.theme.secondary);
            document.documentElement.style.setProperty('--color-glow', this.theme.glow);
        }
    }

    updateConfig(config) {
        if (config.particleCount !== undefined) this.particleCount = config.particleCount;
        if (config.particleSize !== undefined) this.particleSizeMultiplier = config.particleSize;
        if (config.glowIntensity !== undefined) this.glowIntensity = config.glowIntensity;
        if (config.sensitivity !== undefined) this.sensitivity = config.sensitivity;
        if (config.smoothing !== undefined) {
            this.smoothing = config.smoothing;
            this.analyser.smoothingTimeConstant = this.smoothing;
        }
        if (config.motionBlur !== undefined) this.motionBlur = config.motionBlur;
    }

    start() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.render();
    }

    stop() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }

    /**
     * Parse frequencies into key operational bands (Bass, Mids, Highs, Loudness)
     */
    analyzeFrequencies() {
        this.analyser.getByteFrequencyData(this.freqData);
        this.analyser.getByteTimeDomainData(this.timeData);

        let sum = 0;
        let bassSum = 0;
        let midSum = 0;
        let highSum = 0;

        // Sub-ranges
        // Bass: indices 0 to 12 (roughly 0 - 250Hz)
        for (let i = 0; i < 12; i++) {
            bassSum += this.freqData[i];
        }
        // Mids: indices 12 to 64 (roughly 250Hz - 1300Hz)
        for (let i = 12; i < 64; i++) {
            midSum += this.freqData[i];
        }
        // Highs: indices 64 to 256 (roughly 1300Hz - 5000Hz)
        for (let i = 64; i < 256; i++) {
            highSum += this.freqData[i];
        }
        // Total loudness
        for (let i = 0; i < 256; i++) {
            sum += this.freqData[i];
        }

        this.bass = (bassSum / 12) / 255;
        this.mids = (midSum / 52) / 255;
        this.highs = (highSum / 192) / 255;
        this.loudness = (sum / 256) / 255;

        // Pulsate background glow element reactively
        const glowBg = document.getElementById('glow-bg');
        if (glowBg) {
            const scale = 1.0 + (this.bass * 0.15);
            const opacity = 0.4 + (this.loudness * 0.4);
            glowBg.style.transform = `translate(-50%, -50%) scale(${scale})`;
            glowBg.style.opacity = `${opacity}`;
        }
    }

    render() {
        if (!this.isAnimating) return;

        this.analyzeFrequencies();
        this.drawBackground();

        // Draw modes
        switch (this.visualMode) {
            case 'ring':
                this.drawParticleRing();
                break;
            case 'bars':
                this.drawCoronaBars();
                break;
            case 'orbit':
                this.drawOrbitWave();
                break;
            case 'nebula':
                this.drawNebulaGlow();
                break;
        }

        this.animationId = requestAnimationFrame(() => this.render());
    }

    drawBackground() {
        this.ctx.globalCompositeOperation = 'source-over';
        
        if (this.motionBlur) {
            // Motion blur: draw semi-transparent black rectangle over canvas
            this.ctx.fillStyle = `rgba(6, 6, 12, ${0.1 + (0.25 * (1.0 - Math.min(1.0, this.loudness)))})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            this.ctx.clearRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#06060c';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    /* ==========================================================================
       Drawing Mode: PARTICLE RING
       ========================================================================== */
    drawParticleRing() {
        this.ctx.globalCompositeOperation = 'screen';

        // 1. Draw glowing inner core
        const minDim = Math.min(this.width, this.height);
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const coreRadius = (0.12 + this.bass * 0.05) * minDim;

        const grad = this.ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, coreRadius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, this.theme.secondary);
        grad.addColorStop(0.8, this.theme.primary);
        grad.addColorStop(1, 'transparent');

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = grad;
        this.ctx.globalAlpha = 0.75 + this.bass * 0.25;
        this.ctx.fill();

        // 2. Update and Draw Particles
        const count = Math.min(this.particleCount, this.particles.length);
        
        for (let i = 0; i < count; i++) {
            const p = this.particles[i];
            p.update(this.width, this.height, this.freqData, this.sensitivity, this.loudness, this.mouse);
            p.draw(this.ctx, this.particleSizeMultiplier);
        }

        // 3. Draw constellation plexus connections (if particles are close enough)
        if (count < 600) { // Performance check: disable connection lines if particle count is too high
            this.ctx.lineWidth = 0.5;
            this.ctx.shadowBlur = 0;
            
            for (let i = 0; i < count; i += 2) { // Step by 2 to save GPU overhead
                for (let j = i + 1; j < count; j += 4) {
                    const p1 = this.particles[i];
                    const p2 = this.particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist < 60) {
                        const alpha = (1 - (dist / 60)) * 0.15 * this.loudness;
                        this.ctx.strokeStyle = this.theme.secondary;
                        this.ctx.globalAlpha = alpha;
                        this.ctx.beginPath();
                        this.ctx.moveTo(p1.x, p1.y);
                        this.ctx.lineTo(p2.x, p2.y);
                        this.ctx.stroke();
                    }
                }
            }
        }
        
        this.ctx.globalAlpha = 1.0;
    }

    /* ==========================================================================
       Drawing Mode: CORONA BARS
       ========================================================================== */
    drawCoronaBars() {
        this.ctx.globalCompositeOperation = 'screen';
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const minDim = Math.min(this.width, this.height);
        const innerRadius = (0.16 + this.bass * 0.04) * minDim;
        const barCount = 120;
        const angleStep = (Math.PI * 2) / barCount;
        
        // Draw orbital center ring
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = this.theme.secondary;
        this.ctx.lineWidth = 1.5;
        this.ctx.shadowColor = this.theme.secondary;
        this.ctx.shadowBlur = 10 * this.glowIntensity;
        this.ctx.globalAlpha = 0.4;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Draw radial frequency bars
        for (let i = 0; i < barCount; i++) {
            // Map FFT logarithmically or wrapping for symmetric circle bars
            let dataIdx = Math.floor(Math.abs(barCount/2 - i) * (200 / (barCount/2)));
            let rawVal = this.freqData[dataIdx] || 0;
            let audioVal = (rawVal / 255) * this.sensitivity;
            
            // Bar heights
            const barHeight = Math.max(4, audioVal * 160 + (this.bass * 20));
            const angle = i * angleStep;

            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const startX = centerX + cos * innerRadius;
            const startY = centerY + sin * innerRadius;
            const endX = centerX + cos * (innerRadius + barHeight);
            const endY = centerY + sin * (innerRadius + barHeight);

            // Draw premium gradient bar
            const grad = this.ctx.createLinearGradient(startX, startY, endX, endY);
            grad.addColorStop(0, this.theme.secondary);
            grad.addColorStop(0.5, this.theme.primary);
            grad.addColorStop(1, 'rgba(168, 0, 255, 0)');

            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            
            this.ctx.strokeStyle = grad;
            this.ctx.lineWidth = Math.max(1.5, (minDim / 600) * 2.5);
            this.ctx.lineCap = 'round';
            this.ctx.globalAlpha = 0.8 + (audioVal * 0.2);
            
            if (this.glowIntensity > 0) {
                this.ctx.shadowColor = this.theme.primary;
                this.ctx.shadowBlur = 6 * this.glowIntensity;
            }
            
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }

        // Draw mini orbital nodes
        const count = Math.min(200, this.particleCount / 2);
        for (let i = 0; i < count; i++) {
            const p = this.particles[i];
            p.update(this.width, this.height, this.freqData, this.sensitivity, this.loudness, this.mouse);
            p.draw(this.ctx, this.particleSizeMultiplier);
        }

        this.ctx.globalAlpha = 1.0;
    }

    /* ==========================================================================
       Drawing Mode: ORBIT WAVE (Oscilloscope)
       ========================================================================== */
    drawOrbitWave() {
        this.ctx.globalCompositeOperation = 'screen';

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const minDim = Math.min(this.width, this.height);
        const radius = 0.2 * minDim;
        
        // Draw 3 layers of waveforms (different alphas, thicknesses, and offsets)
        const waveLayers = [
            { scale: 0.9, color: this.theme.secondary, alpha: 0.8, thickness: 3 },
            { scale: 1.0, color: this.theme.primary, alpha: 0.6, thickness: 1.5 },
            { scale: 1.1, color: this.theme.tertiary, alpha: 0.4, thickness: 1.0 }
        ];

        waveLayers.forEach((layer) => {
            this.ctx.beginPath();
            this.ctx.lineWidth = layer.thickness;
            this.ctx.strokeStyle = layer.color;
            this.ctx.globalAlpha = layer.alpha;
            
            if (this.glowIntensity > 0) {
                this.ctx.shadowColor = layer.color;
                this.ctx.shadowBlur = 12 * this.glowIntensity;
            }

            const points = 180;
            for (let i = 0; i <= points; i++) {
                // Wrap index safely around the 1024/512 sized timeData buffer
                const timeIndex = Math.floor((i / points) * (this.timeData.length - 1));
                const rawVal = this.timeData[timeIndex] || 128;
                
                // Convert 0-255 time-domain value to normalizer (-1.0 to 1.0)
                const waveVal = ((rawVal - 128) / 128) * this.sensitivity * 0.45;
                
                const angle = (i / points) * Math.PI * 2;
                const dynamicRadius = radius * layer.scale + (waveVal * 120) + (this.bass * 15);
                
                const x = centerX + Math.cos(angle) * dynamicRadius;
                const y = centerY + Math.sin(angle) * dynamicRadius;
                
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.closePath();
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        });

        // Add drifting orbit particles
        const count = Math.min(250, this.particleCount);
        for (let i = 0; i < count; i++) {
            const p = this.particles[i];
            p.update(this.width, this.height, this.freqData, this.sensitivity, this.loudness, this.mouse);
            p.draw(this.ctx, this.particleSizeMultiplier);
        }

        this.ctx.globalAlpha = 1.0;
    }

    /* ==========================================================================
       Drawing Mode: NEBULA GLOW
       ========================================================================== */
    drawNebulaGlow() {
        this.ctx.globalCompositeOperation = 'screen';
        
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const minDim = Math.min(this.width, this.height);
        
        // Fluid Nebula gradients
        const bassImpact = this.bass * 250;
        const radius1 = (0.22 * minDim) + bassImpact;
        const radius2 = (0.42 * minDim) + (this.mids * 100);

        // Core dynamic glow
        const coreGrad = this.ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius1);
        coreGrad.addColorStop(0, '#fff');
        coreGrad.addColorStop(0.3, this.theme.primary);
        coreGrad.addColorStop(0.7, this.theme.tertiary);
        coreGrad.addColorStop(1, 'transparent');

        this.ctx.fillStyle = coreGrad;
        this.ctx.globalAlpha = 0.45 + (this.bass * 0.25);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius1, 0, Math.PI * 2);
        this.ctx.fill();

        // Outer corona nebula glow
        const outerGrad = this.ctx.createRadialGradient(centerX, centerY, radius1 * 0.6, centerX, centerY, radius2);
        outerGrad.addColorStop(0, 'transparent');
        outerGrad.addColorStop(0.5, this.theme.secondary);
        outerGrad.addColorStop(0.8, this.theme.quaternary || this.theme.primary);
        outerGrad.addColorStop(1, 'transparent');

        this.ctx.fillStyle = outerGrad;
        this.ctx.globalAlpha = 0.3 + (this.mids * 0.4);
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius2, 0, Math.PI * 2);
        this.ctx.fill();

        // Floating particle sparks in the nebula clouds
        const count = Math.min(600, this.particleCount);
        for (let i = 0; i < count; i++) {
            const p = this.particles[i];
            
            // Nebula mode overrides - make particles move slower and float like dust
            p.update(this.width, this.height, this.freqData, this.sensitivity, this.loudness, this.mouse);
            
            // Slow them down slightly for dust aesthetic
            p.x += (Math.cos(p.angle) * 0.25);
            p.y += (Math.sin(p.angle) * 0.25);
            
            p.draw(this.ctx, this.particleSizeMultiplier);
        }

        this.ctx.globalAlpha = 1.0;
    }
}
