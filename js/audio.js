class GameAudio {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
        this.isMuted = false;
        
        // Music Sequencer Variables
        this.musicIntervalId = null;
        this.bpm = 115;
        this.currentStep = 0;
        this.nextNoteTime = 0.0;
        this.scheduleAheadTime = 0.1; // How far ahead to schedule audio (seconds)
        this.lookahead = 25.0; // How frequently to call scheduling function (ms)
        
        // Synthesizer patterns (16 steps)
        this.bassline = [
            'C2', 'C2', 'Eb2', 'C2', 'F2', 'C2', 'G2', 'F2',
            'C2', 'C2', 'Eb2', 'C2', 'Bb1', 'Bb1', 'G1', 'B1'
        ];
        
        this.melody = [
            'C4', null, 'Eb4', 'G4', 'F4', null, 'D4', null,
            'C4', 'G4', 'C5', 'Bb4', 'G4', 'F4', 'Eb4', 'D4'
        ];

        this.noteFreqs = {
            'G1': 49.00, 'Bb1': 58.27, 'B1': 61.74,
            'C2': 65.41, 'Eb2': 77.78, 'F2': 87.31, 'G2': 98.00, 'Bb2': 116.54,
            'C3': 130.81, 'Eb3': 155.56, 'F3': 174.61, 'G3': 196.00, 'Bb3': 233.08,
            'C4': 261.63, 'D4': 293.66, 'Eb4': 311.13, 'F4': 349.23, 'G4': 392.00, 'Bb4': 466.16,
            'C5': 523.25
        };
    }

    init() {
        if (this.ctx) return;
        
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();
            
            this.masterVolume = this.ctx.createGain();
            this.masterVolume.gain.setValueAtTime(0.3, this.ctx.currentTime); // 30% volume default
            this.masterVolume.connect(this.ctx.destination);
            
            console.log("Audio initialized successfully");
        } catch (e) {
            console.warn("Web Audio API not supported", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playMove() {
        this.init();
        this.resume();
        if (this.isMuted || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);
        
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        
        osc.connect(gain);
        gain.connect(this.masterVolume);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }

    playRotate() {
        this.init();
        this.resume();
        if (this.isMuted || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.12);
        
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        
        osc.connect(gain);
        gain.connect(this.masterVolume);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
    }

    playLand() {
        this.init();
        this.resume();
        if (this.isMuted || !this.ctx) return;

        // Sand landing noise sound
        const bufferSize = this.ctx.sampleRate * 0.06; // 60ms noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(250, this.ctx.currentTime);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);
        
        noise.start();
        noise.stop(this.ctx.currentTime + 0.06);
    }

    playClear() {
        this.init();
        this.resume();
        if (this.isMuted || !this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C chord arpeggio
        
        notes.forEach((freq, idx) => {
            const time = now + idx * 0.07;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            
            gain.gain.setValueAtTime(0.0, time);
            gain.gain.linearRampToValueAtTime(0.2, time + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
            
            osc.connect(gain);
            gain.connect(this.masterVolume);
            
            osc.start(time);
            osc.stop(time + 0.25);
        });
    }

    playPowerup() {
        this.init();
        this.resume();
        if (this.isMuted || !this.ctx) return;

        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.exponentialRampToValueAtTime(800, now + 0.4);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(300, now);
        osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.4);
        
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterVolume);
        
        osc1.start(now);
        osc1.stop(now + 0.4);
        osc2.start(now);
        osc2.stop(now + 0.4);
    }

    playGameOver() {
        this.init();
        this.resume();
        if (this.isMuted || !this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.8);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.8);
        
        osc.connect(gain);
        gain.connect(this.masterVolume);
        
        osc.start(now);
        osc.stop(now + 0.8);
        
        this.stopMusic();
    }

    // Background Music Logic (Disabled)
    startMusic() {}
    stopMusic() {}
    scheduler() {}
    advanceStep() {}
    scheduleNextStep() {}
    triggerSynthKick() {}
    triggerSynthBass() {}
    triggerSynthMelody() {}

    toggleMute() {
        return true;
    }
}

// Global Audio Instance
const audio = new GameAudio();
