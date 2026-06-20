/**
 * E C H O E S // Procedural Synthesizer & Drum Sequencer
 * Translates math and Web Audio nodes into high-fidelity beats.
 */
class EchoesSynth {
    constructor(audioCtx) {
        this.ctx = audioCtx;
        this.output = this.ctx.createGain();
        this.output.gain.value = 0.8; // Default local gain

        // Master Synth Lowpass Filter (connected to cutoff slider)
        this.synthFilter = this.ctx.createBiquadFilter();
        this.synthFilter.type = 'lowpass';
        this.synthFilter.frequency.value = 1200;
        this.synthFilter.Q.value = 2.5;
        this.synthFilter.connect(this.output);

        // Pre-create White Noise Buffer for Hi-Hats / Snares
        this.noiseBuffer = this.createNoiseBuffer();

        // Sequencer State
        this.isPlaying = false;
        this.bpm = 120;
        this.currentStep = 0;
        this.nextStepTime = 0.0;
        this.scheduleAheadTime = 0.1; // How far ahead to schedule (seconds)
        this.lookahead = 25.0; // How frequently to call scheduling function (ms)
        this.timerId = null;

        // Toggle configuration
        this.beatEnabled = true;
        this.melodyEnabled = true;

        // Melody Pattern (frequencies in Hz for steps 0-15)
        // Root: C minor / C natural minor
        const C3 = 130.81, D3 = 146.83, Eb3 = 155.56, F3 = 174.61, G3 = 196.00, Ab3 = 207.65, Bb3 = 233.08;
        const C4 = 261.63, D4 = 293.66, Eb4 = 311.13, F4 = 349.23, G4 = 392.00, Bb4 = 466.16;
        
        this.melodyPattern = [
            C3,  G3,  Eb3, C4, 
            D3,  Bb3, F3,  D4, 
            Eb3, Bb3, G3,  Eb4,
            F3,  C4,  Ab3, Bb4
        ];
    }

    /**
     * Create 1 channel, 0.2s length white noise buffer
     */
    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 0.25;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /**
     * Connect synth master output to destination Node (Visualizer Analyzer input)
     */
    connect(destination) {
        this.output.connect(destination);
    }

    /**
     * Play/Pause control
     */
    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.currentStep = 0;
        this.nextStepTime = this.ctx.currentTime + 0.05;
        
        // Start scheduler loop
        this.scheduler();
    }

    stop() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        clearTimeout(this.timerId);
    }

    /**
     * Main scheduler loop
     */
    scheduler() {
        if (!this.isPlaying) return;

        while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleStep(this.currentStep, this.nextStepTime);
            this.advanceStep();
        }

        this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
    }

    advanceStep() {
        // 16th notes scheduling
        const secondsPerBeat = 60.0 / this.bpm;
        const secondsPerStep = 0.25 * secondsPerBeat; // 16th note
        this.nextStepTime += secondsPerStep;

        this.currentStep = (this.currentStep + 1) % 16;
    }

    scheduleStep(step, time) {
        // 1. Schedule Drums (Kick & Hihats)
        if (this.beatEnabled) {
            // Kick drum on beats 1, 2, 3, 4 (steps 0, 4, 8, 12)
            if (step === 0 || step === 4 || step === 8 || step === 12) {
                this.playKick(time);
            }
            
            // Off-beat hi-hat (steps 2, 6, 10, 14)
            if (step === 2 || step === 6 || step === 10 || step === 14) {
                this.playHihat(time, 0.03); // Short decay
            }

            // Snare on steps 4, 12 (layered with kick for fuller beat)
            if (step === 4 || step === 12) {
                this.playSnare(time);
            }
        }

        // 2. Schedule Melody Synthesizer
        if (this.melodyEnabled) {
            // Arpeggiator on alternating steps or syncopated
            if (step % 2 === 0 || step === 5 || step === 11 || step === 15) {
                const pitch = this.melodyPattern[step];
                const noteLength = (step % 4 === 0) ? 0.35 : 0.15; // Longer note on main beats
                this.playMelodyNote(pitch, time, noteLength);
            }
        }
    }

    /* ==========================================================================
       Web Audio Node Instrument Engines
       ========================================================================== */

    /**
     * Synthesized Kick Drum
     */
    playKick(time = this.ctx.currentTime) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.output);

        osc.type = 'triangle';
        
        // Frequency sweep envelope: 130Hz -> 0.01Hz rapidly
        osc.frequency.setValueAtTime(120, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.35);

        // Volume envelope: instant attack, exponential decay
        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.38);

        osc.start(time);
        osc.stop(time + 0.4);
    }

    /**
     * Synthesized Snare Drum using White Noise
     */
    playSnare(time = this.ctx.currentTime) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;

        const noiseGain = this.ctx.createGain();
        
        // Routing noise
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.output);

        // Snap volume envelope
        noiseGain.gain.setValueAtTime(0.3, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        noise.start(time);
        noise.stop(time + 0.2);

        // Add a low triangle snap for tone
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.connect(oscGain);
        oscGain.connect(this.output);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, time);
        osc.frequency.linearRampToValueAtTime(80, time + 0.1);
        oscGain.gain.setValueAtTime(0.4, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.12);
    }

    /**
     * Hi-Hat / Cymbal
     */
    playHihat(time = this.ctx.currentTime, decay = 0.04) {
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 8000; // High frequency band for metal tick
        filter.Q.value = 1.0;

        const gain = this.ctx.createGain();

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(this.output);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

        noiseSource.start(time);
        noiseSource.stop(time + decay + 0.05);
    }

    /**
     * Melodic Synth Arpeggiator note
     */
    playMelodyNote(freq, time, duration) {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        // Dual oscillators for rich detuned sound
        osc1.connect(noteGain);
        osc2.connect(noteGain);
        noteGain.connect(this.synthFilter);

        // Cyberpunk synth - square/saw tooth waves
        osc1.type = 'sawtooth';
        osc2.type = 'square';

        osc1.frequency.setValueAtTime(freq, time);
        // Detune osc2 slightly (+5 cents) for width
        osc2.frequency.setValueAtTime(freq * Math.pow(2, 5/1200), time);

        // Amplitude Envelope: short attack, decay to sustain, release
        noteGain.gain.setValueAtTime(0.0, time);
        noteGain.gain.linearRampToValueAtTime(0.22, time + 0.01); // Instant attack
        noteGain.gain.exponentialRampToValueAtTime(0.1, time + duration - 0.02); // Decay
        noteGain.gain.setValueAtTime(0.1, time + duration - 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, time + duration); // Release

        osc1.start(time);
        osc1.stop(time + duration + 0.05);
        osc2.start(time);
        osc2.stop(time + duration + 0.05);
    }

    /* ==========================================================================
       Interactive adjustments
       ========================================================================== */

    setFilterCutoff(freq) {
        // Clamping frequency within normal range
        const clamped = Math.max(200, Math.min(10000, freq));
        // Exponential transition for smoother sound tweaking
        this.synthFilter.frequency.setTargetAtTime(clamped, this.ctx.currentTime, 0.05);
    }

    enableBeat(enabled) {
        this.beatEnabled = enabled;
    }

    enableMelody(enabled) {
        this.melodyEnabled = enabled;
    }

    setVolume(value) {
        this.output.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    }
}
