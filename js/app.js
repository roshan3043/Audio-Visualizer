/**
 * E C H O E S // Application Orchestration & Event Manager
 * Coordinates Web Audio routing, microphone permissions, file system loads,
 * keyboard shortcuts, and HUD state transitions.
 */

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements - Panels & Viewport
    const splashScreen = document.getElementById('splash-screen');
    const btnEnter = document.getElementById('btn-enter');
    const appUi = document.getElementById('app-ui');
    const canvas = document.getElementById('visualizer-canvas');
    const activeTrackName = document.getElementById('active-track-name');
    const controlTrackName = document.getElementById('control-track-name');
    const controlTrackSource = document.getElementById('control-track-source');

    // UI Elements - Buttons & Toggles
    const btnPlayPause = document.getElementById('btn-play-pause');
    const iconPlay = btnPlayPause.querySelector('.icon-play');
    const iconPause = btnPlayPause.querySelector('.icon-pause');
    const btnToggleUi = document.getElementById('btn-toggle-ui');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnResetSettings = document.getElementById('btn-reset-settings');
    const btnVolumeToggle = document.getElementById('btn-volume-toggle');
    const iconVolumeUp = btnVolumeToggle.querySelector('.icon-volume-up');
    const iconVolumeMute = btnVolumeToggle.querySelector('.icon-volume-mute');

    // Mobile Panels & Drawer Toggles
    const panelSources = document.getElementById('panel-sources');
    const panelConfig = document.getElementById('panel-config');
    const btnMobileSources = document.getElementById('btn-mobile-sources');
    const btnMobileConfig = document.getElementById('btn-mobile-config');
    const btnCloseSources = document.getElementById('btn-close-sources');
    const btnCloseConfig = document.getElementById('btn-close-config');

    // UI Elements - Sliders & Inputs
    const sliderVolume = document.getElementById('slider-volume');
    const sliderParticleCount = document.getElementById('slider-particle-count');
    const sliderParticleSize = document.getElementById('slider-particle-size');
    const sliderGlowIntensity = document.getElementById('slider-glow-intensity');
    const sliderSensitivity = document.getElementById('slider-sensitivity');
    const sliderSmoothing = document.getElementById('slider-smoothing');
    const toggleMotionBlur = document.getElementById('toggle-motion-blur');

    // UI Elements - Dynamic Displays
    const valParticleCount = document.getElementById('val-particle-count');
    const valParticleSize = document.getElementById('val-particle-size');
    const valGlowIntensity = document.getElementById('val-glow-intensity');
    const valSensitivity = document.getElementById('val-sensitivity');
    const valSmoothing = document.getElementById('val-smoothing');

    // UI Elements - File Player Timeline
    const timelineContainer = document.getElementById('timeline-container');
    const timeCurrent = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');
    const progressBarWrapper = document.getElementById('progress-bar-wrapper');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressBarHandle = document.getElementById('progress-bar-handle');

    // UI Elements - Source selectors
    const sourceCards = document.querySelectorAll('.source-card');
    const subPanelSynth = document.getElementById('sub-panel-synth');
    const subPanelFile = document.getElementById('sub-panel-file');
    const subPanelMic = document.getElementById('sub-panel-mic');
    const fileUploaderBox = document.getElementById('file-uploader-box');
    const audioFileInput = document.getElementById('audio-file-input');
    const dropZone = document.getElementById('drop-zone');
    const micPulse = document.getElementById('mic-pulse');
    const micStatusText = document.getElementById('mic-status-text');

    // UI Elements - Synth controls
    const btnSynthKick = document.getElementById('btn-synth-kick');
    const btnSynthSnare = document.getElementById('btn-synth-snare');
    const sliderSynthFilter = document.getElementById('slider-synth-filter');
    const valSynthFilter = document.getElementById('val-synth-filter');
    const toggleSynthBeat = document.getElementById('toggle-synth-beat');
    const toggleSynthMelody = document.getElementById('toggle-synth-melody');

    // UI Elements - Toast
    const appToast = document.getElementById('app-toast');

    // Global Audio Architecture Variables
    let audioCtx = null;
    let analyserNode = null;
    let masterGainNode = null;
    let visualizer = null;
    let synth = null;
    
    // Audio Sources
    let currentSourceType = 'synth'; // 'synth' | 'file' | 'mic'
    
    // HTML5 File Player Audio Node Setup
    let audioPlayer = null;
    let playerSourceNode = null;
    
    // Microphone Input Audio Node Setup
    let micStream = null;
    let micSourceNode = null;

    // Volume Control State
    let previousVolume = 0.7;
    let isMuted = false;

    /* ==========================================================================
       Initialisation & Gesture Unlock
       ========================================================================== */
    btnEnter.addEventListener('click', () => {
        initAudioEngine();
        
        // Hide splash screen
        splashScreen.classList.remove('active');
        splashScreen.classList.add('hidden');
        
        // Unhide core visualizer layout
        appUi.classList.remove('hidden');
        
        // Start rendering loops
        visualizer.start();
        showToast("Welcome to Echoes. Press H to toggle HUD, Space to Play/Pause.");

        // Automatically start playing the synth generator out of the box
        if (currentSourceType === 'synth') {
            synth.start();
            updatePlayPauseButton(true);
        }
    });

    function initAudioEngine() {
        // Initialize Web Audio API AudioContext safely
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        
        // Create Master nodes
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 512; // Balanced resolution and lag performance
        analyserNode.smoothingTimeConstant = 0.82;
        
        masterGainNode = audioCtx.createGain();
        masterGainNode.gain.value = 0.7; // default volume

        // Route: Source -> Analyser -> Master Gain -> Speakers
        analyserNode.connect(masterGainNode);
        masterGainNode.connect(audioCtx.destination);

        // Initialize Canvas visualizer
        visualizer = new EchoesVisualizer(canvas, analyserNode);
        window.addEventListener('resize', () => visualizer.resize());

        // Initialize Synth Node generator
        synth = new EchoesSynth(audioCtx);
        synth.connect(analyserNode);

        // Pre-create Audio Element for file playback
        audioPlayer = new Audio();
        audioPlayer.crossOrigin = "anonymous";
        playerSourceNode = audioCtx.createMediaElementSource(audioPlayer);
        playerSourceNode.connect(analyserNode);

        // Synchronize settings with UI sliders
        applyVisualConfigs();
    }

    /* ==========================================================================
       Sound Source Manager Routing
       ========================================================================== */
    sourceCards.forEach(card => {
        card.addEventListener('click', () => {
            const selectedSource = card.dataset.source;
            if (selectedSource === currentSourceType) return;

            // Update active state in list
            sourceCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            // Route audio streams
            switchAudioSource(selectedSource);
        });
    });

    function switchAudioSource(sourceType) {
        if (!audioCtx) return;
        
        // Close mobile drawer on selection
        panelSources.classList.remove('open');

        // Resume AudioContext if suspended (browser security)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        // 1. Teardown current operational node paths
        stopCurrentAudioSources();

        currentSourceType = sourceType;

        // 2. Hide all subpanels, then reveal selected
        subPanelSynth.classList.add('hidden');
        subPanelFile.classList.add('hidden');
        subPanelMic.classList.add('hidden');
        timelineContainer.classList.add('hidden');

        if (sourceType === 'synth') {
            subPanelSynth.classList.remove('hidden');
            activeTrackName.textContent = "Procedural Synthesizer";
            controlTrackName.textContent = "Echoes Ambient Synth";
            controlTrackSource.textContent = "Procedural Generator";
            
            // Automatically launch synth
            synth.start();
            updatePlayPauseButton(true);
            showToast("Playing Echoes Procedural Synthesizer loop.");
        } 
        else if (sourceType === 'file') {
            subPanelFile.classList.remove('hidden');
            timelineContainer.classList.remove('hidden');
            
            const hasFile = audioPlayer && audioPlayer.src;
            if (hasFile) {
                activeTrackName.textContent = audioPlayer._fileName || "Audio Track";
                controlTrackName.textContent = audioPlayer._fileName || "Audio Track";
                controlTrackSource.textContent = "Local File Upload";
                audioPlayer.play();
                updatePlayPauseButton(true);
            } else {
                activeTrackName.textContent = "Waiting for file...";
                controlTrackName.textContent = "No Track Loaded";
                controlTrackSource.textContent = "Select file to play";
                updatePlayPauseButton(false);
            }
        } 
        else if (sourceType === 'mic') {
            subPanelMic.classList.remove('hidden');
            activeTrackName.textContent = "Microphone Source";
            controlTrackName.textContent = "Microphone Real-time";
            controlTrackSource.textContent = "Environmental Capture";
            updatePlayPauseButton(false); // Play/pause isn't active on microphone
            
            // Request microphone permissions
            initMicrophoneCapture();
        }
    }

    function stopCurrentAudioSources() {
        // Stop Synth Loop
        if (synth) synth.stop();

        // Stop Audio File player
        if (audioPlayer) {
            audioPlayer.pause();
        }

        // Teardown microphone node routing
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }
        if (micSourceNode) {
            micSourceNode.disconnect();
            micSourceNode = null;
        }
        
        micPulse.classList.remove('listening');
        micStatusText.textContent = "Microphone Standby";
        updatePlayPauseButton(false);
    }

    /* ==========================================================================
       Microphone Capturing
       ========================================================================== */
    function initMicrophoneCapture() {
        micStatusText.textContent = "Requesting permission...";
        
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                micStream = stream;
                micSourceNode = audioCtx.createMediaStreamSource(stream);
                micSourceNode.connect(analyserNode);

                micPulse.classList.add('listening');
                micStatusText.textContent = "Capture Active";
                showToast("Microphone capture active. Avoid speaker feedback!");
            })
            .catch(err => {
                console.error("Microphone capture failed:", err);
                micStatusText.textContent = "Access Denied";
                showToast("Access denied: could not capture microphone input.");
                
                // Fallback to synth source on failure
                setTimeout(() => {
                    const synthCard = document.querySelector('[data-source="synth"]');
                    if (synthCard) synthCard.click();
                }, 1500);
            });
    }

    /* ==========================================================================
       Local File Uploading & Controls
       ========================================================================== */
    fileUploaderBox.addEventListener('click', () => {
        audioFileInput.click();
    });

    audioFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadLocalAudioFile(e.target.files[0]);
        }
    });

    // Drag and drop event listeners
    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (currentSourceType === 'file') {
            dropZone.classList.add('active');
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('active');
        
        if (currentSourceType === 'file' && e.dataTransfer.files.length > 0) {
            loadLocalAudioFile(e.dataTransfer.files[0]);
        }
    });

    function loadLocalAudioFile(file) {
        if (!file.type.startsWith('audio/')) {
            showToast("Invalid format. Please load a valid audio file.");
            return;
        }

        // Audio size validation (e.g. 50MB)
        if (file.size > 50 * 1024 * 1024) {
            showToast("File size too large. Keep it under 50MB.");
            return;
        }

        // Create Object URL for client side local stream loading
        const objectURL = URL.createObjectURL(file);
        audioPlayer.src = objectURL;
        audioPlayer._fileName = file.name;

        activeTrackName.textContent = file.name;
        controlTrackName.textContent = file.name;
        controlTrackSource.textContent = "Local File Upload";

        audioPlayer.play()
            .then(() => {
                updatePlayPauseButton(true);
                showToast(`Track "${file.name}" loaded successfully.`);
            })
            .catch(err => {
                console.error("Audio playback error:", err);
                showToast("Could not play audio. File may be corrupted.");
            });
    }

    /* ==========================================================================
       Audio Element Seekers & Synchronization
       ========================================================================== */
    audioPlayer.addEventListener('timeupdate', () => {
        if (!audioPlayer || isNaN(audioPlayer.duration)) return;
        
        // Update elapsed time text displays
        timeCurrent.textContent = formatTime(audioPlayer.currentTime);
        timeDuration.textContent = formatTime(audioPlayer.duration);
        
        // Progress Fill percentage
        const progressPct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBarFill.style.width = `${progressPct}%`;
        progressBarHandle.style.left = `${progressPct}%`;
    });

    audioPlayer.addEventListener('ended', () => {
        updatePlayPauseButton(false);
    });

    progressBarWrapper.addEventListener('click', (e) => {
        if (!audioPlayer || isNaN(audioPlayer.duration)) return;

        const rect = progressBarWrapper.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const widthPct = Math.max(0, Math.min(1, clickX / rect.width));

        // Skip audio play head
        audioPlayer.currentTime = widthPct * audioPlayer.duration;
    });

    // Support dragging handle
    let isDraggingTimeline = false;
    progressBarWrapper.addEventListener('mousedown', () => {
        isDraggingTimeline = true;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDraggingTimeline || !audioPlayer || isNaN(audioPlayer.duration)) return;
        
        const rect = progressBarWrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, mouseX / rect.width));
        
        progressBarFill.style.width = `${pct * 100}%`;
        progressBarHandle.style.left = `${pct * 100}%`;
    });

    window.addEventListener('mouseup', (e) => {
        if (isDraggingTimeline) {
            isDraggingTimeline = false;
            if (audioPlayer && !isNaN(audioPlayer.duration)) {
                const rect = progressBarWrapper.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, mouseX / rect.width));
                audioPlayer.currentTime = pct * audioPlayer.duration;
            }
        }
    });

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    /* ==========================================================================
       Synthesizer Settings Bindings
       ========================================================================== */
    btnSynthKick.addEventListener('click', () => {
        if (synth) synth.playKick();
    });

    btnSynthSnare.addEventListener('click', () => {
        if (synth) synth.playSnare();
    });

    sliderSynthFilter.addEventListener('input', (e) => {
        const freq = parseInt(e.target.value);
        valSynthFilter.textContent = `${freq}Hz`;
        if (synth) synth.setFilterCutoff(freq);
    });

    toggleSynthBeat.addEventListener('change', (e) => {
        if (synth) synth.enableBeat(e.target.checked);
    });

    toggleSynthMelody.addEventListener('change', (e) => {
        if (synth) synth.enableMelody(e.target.checked);
    });

    /* ==========================================================================
       Visualizer Configuration Panel Event Bindings
       ========================================================================== */
    
    // 1. Visual Modes
    const modeButtons = document.querySelectorAll('.btn-mode');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const mode = btn.dataset.mode;
            if (visualizer) visualizer.visualMode = mode;
            showToast(`Switched mode to ${mode.toUpperCase()}.`);
        });
    });

    // 2. Color Themes
    const themeButtons = document.querySelectorAll('.btn-theme');
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            themeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const theme = btn.dataset.theme;
            if (visualizer) visualizer.setTheme(theme);
            const themeDisplayName = theme.charAt(0).toUpperCase() + theme.slice(1);
            showToast(`Color palette updated to ${themeDisplayName}.`);
        });
    });

    // 3. Slider parameters
    sliderParticleCount.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        valParticleCount.textContent = val;
        if (visualizer) visualizer.updateConfig({ particleCount: val });
    });

    sliderParticleSize.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        valParticleSize.textContent = `${val.toFixed(1)}px`;
        if (visualizer) visualizer.updateConfig({ particleSize: val });
    });

    sliderGlowIntensity.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        valGlowIntensity.textContent = val.toFixed(1);
        if (visualizer) visualizer.updateConfig({ glowIntensity: val });
    });

    sliderSensitivity.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        valSensitivity.textContent = val.toFixed(1);
        if (visualizer) visualizer.updateConfig({ sensitivity: val });
    });

    sliderSmoothing.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        valSmoothing.textContent = val.toFixed(2);
        if (visualizer) visualizer.updateConfig({ smoothing: val });
    });

    toggleMotionBlur.addEventListener('change', (e) => {
        if (visualizer) visualizer.updateConfig({ motionBlur: e.target.checked });
    });

    function applyVisualConfigs() {
        if (!visualizer) return;
        visualizer.updateConfig({
            particleCount: parseInt(sliderParticleCount.value),
            particleSize: parseFloat(sliderParticleSize.value),
            glowIntensity: parseFloat(sliderGlowIntensity.value),
            sensitivity: parseFloat(sliderSensitivity.value),
            smoothing: parseFloat(sliderSmoothing.value),
            motionBlur: toggleMotionBlur.checked
        });
    }

    // Reset parameters
    btnResetSettings.addEventListener('click', () => {
        // Reset inputs to default values
        sliderParticleCount.value = 400;
        valParticleCount.textContent = 400;
        
        sliderParticleSize.value = 2.0;
        valParticleSize.textContent = "2.0px";
        
        sliderGlowIntensity.value = 1.2;
        valGlowIntensity.textContent = "1.2";
        
        sliderSensitivity.value = 1.5;
        valSensitivity.textContent = "1.5";
        
        sliderSmoothing.value = 0.82;
        valSmoothing.textContent = "0.82";

        toggleMotionBlur.checked = true;

        applyVisualConfigs();
        showToast("Visual configuration restored to defaults.");
    });

    /* ==========================================================================
       Master Volume Control
       ========================================================================== */
    sliderVolume.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        if (masterGainNode) {
            masterGainNode.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.02);
        }
        
        if (vol === 0) {
            toggleVolumeIcon(true);
        } else {
            toggleVolumeIcon(false);
            previousVolume = vol;
            isMuted = false;
        }
    });

    btnVolumeToggle.addEventListener('click', () => {
        if (!masterGainNode) return;
        
        if (isMuted) {
            // Unmute
            masterGainNode.gain.setTargetAtTime(previousVolume, audioCtx.currentTime, 0.02);
            sliderVolume.value = previousVolume;
            toggleVolumeIcon(false);
            isMuted = false;
        } else {
            // Mute
            previousVolume = parseFloat(sliderVolume.value);
            masterGainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
            sliderVolume.value = 0;
            toggleVolumeIcon(true);
            isMuted = true;
        }
    });

    function toggleVolumeIcon(mute) {
        if (mute) {
            iconVolumeUp.classList.add('hidden');
            iconVolumeMute.classList.remove('hidden');
        } else {
            iconVolumeUp.classList.remove('hidden');
            iconVolumeMute.classList.add('hidden');
        }
    }

    /* ==========================================================================
       Playback Toggle Controls
       ========================================================================== */
    btnPlayPause.addEventListener('click', () => {
        togglePlayback();
    });

    function togglePlayback() {
        if (!audioCtx) return;
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        if (currentSourceType === 'synth') {
            if (synth.isPlaying) {
                synth.stop();
                updatePlayPauseButton(false);
            } else {
                synth.start();
                updatePlayPauseButton(true);
            }
        } 
        else if (currentSourceType === 'file') {
            if (!audioPlayer.src) {
                showToast("Please select an audio file first.");
                return;
            }
            if (audioPlayer.paused) {
                audioPlayer.play();
                updatePlayPauseButton(true);
            } else {
                audioPlayer.pause();
                updatePlayPauseButton(false);
            }
        }
        else if (currentSourceType === 'mic') {
            showToast("Play/Pause control is not applicable to live microphone capture.");
        }
    }

    function updatePlayPauseButton(isPlaying) {
        if (isPlaying) {
            iconPlay.classList.add('hidden');
            iconPause.classList.remove('hidden');
            document.querySelector('.now-playing-panel').classList.add('active');
        } else {
            iconPlay.classList.remove('hidden');
            iconPause.classList.add('hidden');
            document.querySelector('.now-playing-panel').classList.remove('active');
        }
    }

    /* ==========================================================================
       HUD UI & Fullscreen Control States
       ========================================================================== */
    btnToggleUi.addEventListener('click', () => {
        toggleUIHUD();
    });

    // Mobile Drawer Interactions
    btnMobileSources.addEventListener('click', (e) => {
        e.stopPropagation();
        panelSources.classList.toggle('open');
        panelConfig.classList.remove('open');
    });

    btnMobileConfig.addEventListener('click', (e) => {
        e.stopPropagation();
        panelConfig.classList.toggle('open');
        panelSources.classList.remove('open');
    });

    btnCloseSources.addEventListener('click', (e) => {
        e.stopPropagation();
        panelSources.classList.remove('open');
    });

    btnCloseConfig.addEventListener('click', (e) => {
        e.stopPropagation();
        panelConfig.classList.remove('open');
    });

    // Tap canvas background to close drawers on mobile
    canvas.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            panelSources.classList.remove('open');
            panelConfig.classList.remove('open');
        }
    });

    function toggleUIHUD() {
        appUi.classList.toggle('clean-mode');
        const isClean = appUi.classList.contains('clean-mode');
        showToast(isClean ? "HUD Hidden. Press H to reveal." : "HUD Visible.");
    }

    btnFullscreen.addEventListener('click', () => {
        toggleFullscreenState();
    });

    function toggleFullscreenState() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .catch(err => {
                    showToast(`Error enabling fullscreen: ${err.message}`);
                });
        } else {
            document.exitFullscreen();
        }
    }

    /* ==========================================================================
       Keyboard Shortcuts System (Space, H, F)
       ========================================================================== */
    window.addEventListener('keydown', (e) => {
        // Prevent trigger if splash is open or user is typing (safety check)
        if (splashScreen.classList.contains('active')) return;
        
        const key = e.key.toLowerCase();
        
        if (key === ' ' || e.code === 'Space') {
            e.preventDefault(); // Prevent page scrolling down
            togglePlayback();
        } 
        else if (key === 'h') {
            toggleUIHUD();
        } 
        else if (key === 'f') {
            toggleFullscreenState();
        }
    });

    /* ==========================================================================
       Toast Notifications
       ========================================================================== */
    let toastTimeout = null;
    function showToast(message) {
        appToast.querySelector('.toast-message').textContent = message;
        appToast.classList.add('show');

        if (toastTimeout) clearTimeout(toastTimeout);
        
        toastTimeout = setTimeout(() => {
            appToast.classList.remove('show');
        }, 3200);
    }
});
