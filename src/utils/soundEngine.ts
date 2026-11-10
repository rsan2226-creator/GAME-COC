// Hybrid Sound Engine & Global Indoor Hall Acoustic DSP for Class of Champions
// Routes all 8 studio MP3 audio assets AND all synthesized UI/Game SFX through
// a Web Audio API Clarity Enhancer (Presence EQ + Compressor + Preamp Boost)
// and Convolver Indoor Room Reverb across all menus.

export const STUDIO_AUDIO_ASSETS = {
  GLASS_BELLS_AMBIENCE:
    '/assets/aistudio/fronbondi_skegs-sfx-gentle-glass-bells-ringtone-sound-effect-320337_d6b2e800.mp3',
  VICTORY_TRUMPET:
    '/assets/aistudio/astralsynthesizer-11l-victory_trumpet-1749704498589-358767_d08cb0ca.mp3',
  VICTORY_BEAT_CHIME:
    '/assets/aistudio/astralsynthesizer-11l-victory_beat-1749704511321-358765_feb34c93.mp3',
  VICTORY_BRASS_1:
    '/assets/aistudio/peekaboolabcreative-11l-victory_sound_with_t-1749487415737-357605_6c938cb6.mp3',
  VICTORY_ORCHESTRA_HIT:
    '/assets/aistudio/peekaboolabcreative-11l-victory_sound_with_t-1749487402950-357606_c1756d65.mp3',
  VICTORY_FANFARE_DOUBLE:
    '/assets/aistudio/peekaboolabcreative-11l-victory_sound_with_t-1749487409696-357609_c8ae1568.mp3',
  CHAMPIONSHIP_ANTHEM:
    '/assets/aistudio/rfm-1011-victory-at-last-486385_e4661236.mp3',
  CHOOSE_YOUR_CHAMPION:
    '/assets/aistudio/phatphrogstudio-moba-announcer-choose-champion-477838_01dabf49.mp3',
} as const;

export type StudioAssetKey = keyof typeof STUDIO_AUDIO_ASSETS;

export type IndoorRoomPreset =
  | 'AULA_BESAR'
  | 'STADION_MEGA'
  | 'RUANG_KELAS'
  | 'STUDIO_JERNIH';

export interface IndoorRoomPresetOption {
  id: IndoorRoomPreset;
  label: string;
  shortLabel: string;
  description: string;
  reverbDuration: number;
  reverbDecay: number;
  wetLevel: number;
  echoDelaySec: number;
  echoFeedback: number;
  echoWet: number;
}

export const INDOOR_ROOM_PRESETS: IndoorRoomPresetOption[] = [
  {
    id: 'AULA_BESAR',
    label: 'Gema Dalam Ruangan (Aula Kompetisi)',
    shortLabel: 'Aula Kompetisi',
    description: 'Pantulan akustik dalam ruangan aula besar yang hangat, megah, dan sangat jelas di semua menu',
    reverbDuration: 2.2,
    reverbDecay: 2.3,
    wetLevel: 0.62,
    echoDelaySec: 0.095,
    echoFeedback: 0.32,
    echoWet: 0.36,
  },
  {
    id: 'STADION_MEGA',
    label: 'Gema Stadion Arena (Echo Megah)',
    shortLabel: 'Stadion Arena',
    description: 'Efek suara dalam ruangan stadion raksasa dengan pantulan gema panjang ala panggung kejuaraan',
    reverbDuration: 2.8,
    reverbDecay: 1.9,
    wetLevel: 0.78,
    echoDelaySec: 0.145,
    echoFeedback: 0.42,
    echoWet: 0.46,
  },
  {
    id: 'RUANG_KELAS',
    label: 'Akustik Ruang Kelas / Hall Sedang',
    shortLabel: 'Ruang Kelas',
    description: 'Pantulan ruangan sedang yang natural dan ekstra nyaring untuk speaker laptop atau proyektor',
    reverbDuration: 1.35,
    reverbDecay: 2.8,
    wetLevel: 0.45,
    echoDelaySec: 0.065,
    echoFeedback: 0.22,
    echoWet: 0.28,
  },
  {
    id: 'STUDIO_JERNIH',
    label: 'Studio Jernih (Tanpa Gema Ruangan)',
    shortLabel: 'Studio Jernih',
    description: 'Efek suara langsung dengan penguat kejernihan maksimal tanpa gema pantulan ruangan',
    reverbDuration: 0.2,
    reverbDecay: 4.0,
    wetLevel: 0.0,
    echoDelaySec: 0.05,
    echoFeedback: 0.0,
    echoWet: 0.0,
  },
];

export interface SoundEngineSnapshot {
  isMuted: boolean;
  volume: number;
  roomPreset: IndoorRoomPreset;
  clarityBoost: number; // 1.0 to 2.2
}

type SoundListener = (snap: SoundEngineSnapshot) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.95; // Default loud & clear (95%)
  private roomPreset: IndoorRoomPreset = 'AULA_BESAR';
  private clarityBoost: number = 1.75; // Default 175% clarity preamp boost so all SFX cut through clearly

  // Web Audio Master Graph Nodes
  private masterInput: GainNode | null = null;
  private presenceEq: BiquadFilterNode | null = null;
  private subWarmthEq: BiquadFilterNode | null = null;
  private dryGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private echoDelay: DelayNode | null = null;
  private echoFeedbackGain: GainNode | null = null;
  private echoWetGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterOutput: GainNode | null = null;

  // Cached Impulse Responses per room preset
  private impulseCache: Map<IndoorRoomPreset, AudioBuffer> = new Map();

  // Decoded AudioBuffers for the 8 studio MP3s (for instant, boosted, reverberant playback)
  private rawArrayBuffers: Map<string, ArrayBuffer> = new Map();
  private decodedBuffers: Map<string, AudioBuffer> = new Map();

  // Active looping sources (Question Bells & Victory Anthem)
  private activeBellsSource: AudioBufferSourceNode | null = null;
  private activeBellsGain: GainNode | null = null;
  private activeAnthemSource: AudioBufferSourceNode | null = null;
  private activeAnthemGain: GainNode | null = null;
  private fallbackBellsAudio: HTMLAudioElement | null = null;
  private fallbackAnthemAudio: HTMLAudioElement | null = null;

  private correctFanfareIndex: number = 0;
  private listeners: Set<SoundListener> = new Set();

  constructor() {
    try {
      const savedMute = localStorage.getItem('coc_sound_muted');
      const savedVol = localStorage.getItem('coc_sound_volume');
      const savedRoom = localStorage.getItem('coc_sound_room_preset') as IndoorRoomPreset | null;
      const savedBoost = localStorage.getItem('coc_sound_clarity_boost');
      if (savedMute !== null) this.isMuted = JSON.parse(savedMute);
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) this.volume = parsed;
      }
      if (savedRoom && INDOOR_ROOM_PRESETS.some((p) => p.id === savedRoom)) {
        this.roomPreset = savedRoom;
      }
      if (savedBoost !== null) {
        const parsedBoost = parseFloat(savedBoost);
        if (!isNaN(parsedBoost) && parsedBoost >= 1.0 && parsedBoost <= 2.5) {
          this.clarityBoost = parsedBoost;
        }
      }
    } catch {}

    // Pre-fetch all 8 MP3 assets as ArrayBuffers so they can be decoded into Web Audio Buffers immediately
    if (typeof window !== 'undefined') {
      Object.values(STUDIO_AUDIO_ASSETS).forEach((src) => {
        fetch(src)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
          .then((buf) => {
            this.rawArrayBuffers.set(src, buf);
            if (this.ctx) {
              this.decodeAssetBuffer(src, buf);
            }
          })
          .catch(() => {});
      });
    }
  }

  private decodeAssetBuffer(src: string, rawBuf: ArrayBuffer) {
    if (!this.ctx || this.decodedBuffers.has(src)) return;
    try {
      const cloned = rawBuf.slice(0);
      this.ctx.decodeAudioData(
        cloned,
        (audioBuf) => {
          this.decodedBuffers.set(src, audioBuf);
        },
        () => {}
      );
    } catch {}
  }

  public subscribe(listener: SoundListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): SoundEngineSnapshot {
    return {
      isMuted: this.isMuted,
      volume: this.volume,
      roomPreset: this.roomPreset,
      clarityBoost: this.clarityBoost,
    };
  }

  private notify() {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  // Expose the shared AudioContext & Master Input Node so ModeratorEngine can also route through it
  public getMasterAudioGraph(): { ctx: AudioContext; destinationNode: AudioNode } | null {
    const ctx = this.getContext();
    if (!ctx || !this.masterInput) return null;
    return { ctx, destinationNode: this.masterInput };
  }

  private buildRoomImpulse(ctx: AudioContext, preset: IndoorRoomPresetOption): AudioBuffer {
    const cached = this.impulseCache.get(preset.id);
    if (cached) return cached;

    const sampleRate = ctx.sampleRate;
    const duration = Math.max(0.2, preset.reverbDuration);
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    // Early indoor room wall reflections (in seconds)
    const earlyTapTimes = [0.014, 0.027, 0.043, 0.068, 0.095, 0.128, 0.165];

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const norm = i / length;
        // Smooth exponential indoor hall decay
        const envelope = Math.pow(1 - norm, preset.reverbDecay);
        // High-frequency air absorption damping over time so reverb is warm and never muddy
        const dampedNoise = (Math.random() * 2 - 1) * (1 - norm * 0.35);
        data[i] = dampedNoise * envelope * 0.52;
      }

      // Inject distinct indoor early reflections for realistic room dimension
      earlyTapTimes.forEach((tapSec, idx) => {
        const stereoOffset = ch === 0 ? tapSec : tapSec + 0.004;
        const sampleIdx = Math.floor(stereoOffset * sampleRate);
        if (sampleIdx < length) {
          const tapGain = Math.pow(0.76, idx) * 0.65;
          data[sampleIdx] += (ch === 0 ? 1 : -1) * tapGain;
        }
      });
    }

    this.impulseCache.set(preset.id, impulse);
    return impulse;
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupMasterAcousticGraph(this.ctx);

        // Decode any already-fetched MP3 buffers
        this.rawArrayBuffers.forEach((buf, src) => {
          this.decodeAssetBuffer(src, buf);
        });
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupMasterAcousticGraph(ctx: AudioContext) {
    this.masterInput = ctx.createGain();
    this.masterInput.gain.value = this.clarityBoost;

    // 1. Warm Low-Mid Body Filter (220 Hz) so buzzers, chimes, and voices sound full
    this.subWarmthEq = ctx.createBiquadFilter();
    this.subWarmthEq.type = 'peaking';
    this.subWarmthEq.frequency.value = 240;
    this.subWarmthEq.Q.value = 1.1;
    this.subWarmthEq.gain.value = 3.5;

    // 2. Crystal Clarity Presence Boost (2600 Hz) so all sound effects are heard clearly in classrooms
    this.presenceEq = ctx.createBiquadFilter();
    this.presenceEq.type = 'peaking';
    this.presenceEq.frequency.value = 2600;
    this.presenceEq.Q.value = 1.2;
    this.presenceEq.gain.value = 5.0;

    // 3. Dry Path
    this.dryGain = ctx.createGain();

    // 4. Convolver Indoor Room Reverb Path
    this.convolver = ctx.createConvolver();
    this.reverbWetGain = ctx.createGain();

    // 5. Indoor Slapback Echo Path
    this.echoDelay = ctx.createDelay(1.0);
    this.echoFeedbackGain = ctx.createGain();
    this.echoWetGain = ctx.createGain();

    // High-cut filter on the echo so echoes sound like natural indoor walls without harshness
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 3200;

    // 6. Broadcast Dynamics Compressor / Limiter (makes quiet sounds loud and prevents clipping)
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4.5;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;

    // 7. Master Volume Output
    this.masterOutput = ctx.createGain();
    this.masterOutput.gain.value = this.isMuted ? 0 : this.volume;

    // Connect Graph:
    // masterInput -> subWarmthEq -> presenceEq
    this.masterInput.connect(this.subWarmthEq);
    this.subWarmthEq.connect(this.presenceEq);

    // Dry signal -> compressor
    this.presenceEq.connect(this.dryGain);
    this.dryGain.connect(this.compressor);

    // Convolver Reverb -> reverbWetGain -> compressor
    this.presenceEq.connect(this.convolver);
    this.convolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.compressor);

    // Echo Delay -> echoFilter -> echoWetGain -> compressor (with feedback loop)
    this.presenceEq.connect(this.echoDelay);
    this.echoDelay.connect(echoFilter);
    echoFilter.connect(this.echoFeedbackGain);
    this.echoFeedbackGain.connect(this.echoDelay);
    echoFilter.connect(this.echoWetGain);
    this.echoWetGain.connect(this.compressor);

    // Compressor -> masterOutput -> destination
    this.compressor.connect(this.masterOutput);
    this.masterOutput.connect(ctx.destination);

    this.applyRoomPresetParameters();
  }

  private applyRoomPresetParameters() {
    if (!this.ctx || !this.convolver || !this.reverbWetGain || !this.echoDelay || !this.echoFeedbackGain || !this.echoWetGain || !this.dryGain || !this.masterInput) {
      return;
    }

    const preset =
      INDOOR_ROOM_PRESETS.find((p) => p.id === this.roomPreset) || INDOOR_ROOM_PRESETS[0];

    const now = this.ctx.currentTime;
    this.masterInput.gain.setTargetAtTime(this.clarityBoost, now, 0.02);
    this.dryGain.gain.setTargetAtTime(1.0, now, 0.02);

    this.convolver.buffer = this.buildRoomImpulse(this.ctx, preset);
    this.reverbWetGain.gain.setTargetAtTime(preset.wetLevel, now, 0.02);

    this.echoDelay.delayTime.setTargetAtTime(preset.echoDelaySec, now, 0.02);
    this.echoFeedbackGain.gain.setTargetAtTime(preset.echoFeedback, now, 0.02);
    this.echoWetGain.gain.setTargetAtTime(preset.echoWet, now, 0.02);
  }

  public setRoomPreset(preset: IndoorRoomPreset, playPreview: boolean = true) {
    this.roomPreset = preset;
    try {
      localStorage.setItem('coc_sound_room_preset', preset);
    } catch {}
    this.getContext();
    this.applyRoomPresetParameters();
    this.notify();
    if (playPreview && !this.isMuted) {
      this.playRoomAcousticPreview();
    }
  }

  public getRoomPreset(): IndoorRoomPreset {
    return this.roomPreset;
  }

  public setClarityBoost(boost: number, playPreview: boolean = false) {
    this.clarityBoost = Math.max(1.0, Math.min(2.4, boost));
    try {
      localStorage.setItem('coc_sound_clarity_boost', String(this.clarityBoost));
    } catch {}
    if (this.ctx && this.masterInput) {
      this.masterInput.gain.setTargetAtTime(this.clarityBoost, this.ctx.currentTime, 0.02);
    }
    this.notify();
    if (playPreview && !this.isMuted) {
      this.playClick();
    }
  }

  public getClarityBoost(): number {
    return this.clarityBoost;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('coc_sound_muted', JSON.stringify(muted));
    } catch {}
    if (this.ctx && this.masterOutput) {
      this.masterOutput.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
    if (muted) {
      this.stopVictoryAmbience();
      this.stopQuestionBellsAmbience();
    }
    this.notify();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('coc_sound_volume', String(this.volume));
    } catch {}
    if (this.ctx && this.masterOutput) {
      this.masterOutput.gain.setTargetAtTime(
        this.isMuted ? 0 : this.volume,
        this.ctx.currentTime,
        0.02
      );
    }
    if (this.fallbackAnthemAudio) {
      this.fallbackAnthemAudio.volume = this.isMuted ? 0 : Math.min(1, this.volume * 0.75);
    }
    if (this.fallbackBellsAudio) {
      this.fallbackBellsAudio.volume = this.isMuted ? 0 : Math.min(1, this.volume * 0.35);
    }
    this.notify();
  }

  public getVolume(): number {
    return this.volume;
  }

  // Route any HTMLAudioElement through the Master Indoor Reverb & Clarity Graph
  public routeAudioElementToRoom(audio: HTMLAudioElement, gainBoost: number = 1.15) {
    const ctx = this.getContext();
    if (!ctx || !this.masterInput) return;
    try {
      const source = ctx.createMediaElementSource(audio);
      const preGain = ctx.createGain();
      preGain.gain.value = gainBoost;
      source.connect(preGain);
      preGain.connect(this.masterInput);
    } catch {
      // Fallback if already connected
    }
  }

  // Play a one-shot MP3 file routed through the Web Audio Indoor Hall Reverb & Clarity Preamp!
  public playMp3(src: string, volumeScale: number = 1.15): void {
    if (this.isMuted || this.volume <= 0 || typeof window === 'undefined') return;
    const ctx = this.getContext();

    // Prefer decoded Web Audio Buffer for zero latency, >100% clarity boost, and full indoor hall reverb
    const decoded = this.decodedBuffers.get(src);
    if (ctx && this.masterInput && decoded) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        const gainNode = ctx.createGain();
        gainNode.gain.value = volumeScale;
        source.connect(gainNode);
        gainNode.connect(this.masterInput);
        source.start(0);
        return;
      } catch {}
    }

    // Fallback to HTMLAudioElement routed into Web Audio Master Room Graph
    try {
      const audio = new Audio(src);
      audio.volume = Math.max(0.1, Math.min(1, this.volume));
      this.routeAudioElementToRoom(audio, volumeScale);
      audio.play().catch(() => {});
    } catch {}
  }

  // Synthesize rich multi-harmonic tones routed through the Master Indoor Room Reverb Bus
  private playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    startTimeOffset: number = 0,
    gainMultiplier: number = 0.45,
    slideToFreq?: number
  ) {
    if (this.isMuted || this.volume <= 0) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterInput) return;

    const now = ctx.currentTime + startTimeOffset;
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, now + duration);
    }

    // Add subtle octave harmonic for richness and speaker clarity
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq * 2, now);
    if (slideToFreq) {
      subOsc.frequency.exponentialRampToValueAtTime(slideToFreq * 2, now + duration);
    }
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.28;

    const peakGain = Math.max(0.005, gainMultiplier);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + Math.min(0.015, duration * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    osc.connect(gain);
    subOsc.connect(harmonicGain);
    harmonicGain.connect(gain);

    // Connect directly to Master Indoor Hall Reverb & Clarity Bus!
    gain.connect(this.masterInput);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + duration + 0.02);
    subOsc.stop(now + duration + 0.02);
  }

  // Audible Room Acoustic Chime when testing or switching Indoor Room Presets in any menu
  public playRoomAcousticPreview() {
    this.playTone(523.25, 'triangle', 0.18, 0, 0.48); // C5
    this.playTone(659.25, 'triangle', 0.22, 0.09, 0.52); // E5
    this.playTone(783.99, 'sine', 0.35, 0.18, 0.58); // G5
    this.playTone(1046.5, 'sine', 0.55, 0.28, 0.62); // C6 (rings out into the indoor hall reverb!)
  }

  // Clear, resonant hover tick for 3D boxes and buttons across all menus
  public playHover() {
    this.playTone(740, 'sine', 0.06, 0, 0.22, 920);
  }

  // Crisp, unmistakable UI button click with indoor hall reflection
  public playClick() {
    this.playTone(587.33, 'triangle', 0.085, 0, 0.42, 880);
    this.playTone(1174.66, 'sine', 0.065, 0.015, 0.28);
  }

  // Distinct menu & tab switch chime (used across Beranda, Arena, Podium, Poster A4, Panduan, Riwayat)
  public playMenuSwitch() {
    this.playTone(440, 'triangle', 0.11, 0, 0.42, 587.33);
    this.playTone(880, 'sine', 0.18, 0.06, 0.46, 1046.5);
  }

  // Tactile keypad press sound in QuestionModal
  public playKeyPress() {
    this.playTone(660, 'triangle', 0.075, 0, 0.38, 780);
  }

  // Epic "CHOOSE YOUR CHAMPION!" voiceover announcer with indoor hall reverb
  public playChooseYourChampion() {
    this.playMp3(STUDIO_AUDIO_ASSETS.CHOOSE_YOUR_CHAMPION, 1.35);
  }

  // Opening a question box (plays magical Victory Beat chime + gentle glass bells ambience)
  public playBoxOpen() {
    this.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_BEAT_CHIME, 1.3);
    this.startQuestionBellsAmbience();
  }

  // Gentle Glass Bells background melody while Question Modal is open
  public startQuestionBellsAmbience() {
    this.stopQuestionBellsAmbience();
    if (this.isMuted || this.volume <= 0 || typeof window === 'undefined') return;

    const ctx = this.getContext();
    const decoded = this.decodedBuffers.get(STUDIO_AUDIO_ASSETS.GLASS_BELLS_AMBIENCE);
    if (ctx && this.masterInput && decoded) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0.24;
        source.connect(gain);
        gain.connect(this.masterInput);
        source.start(0);
        this.activeBellsSource = source;
        this.activeBellsGain = gain;
        return;
      } catch {}
    }

    try {
      const bells = new Audio(STUDIO_AUDIO_ASSETS.GLASS_BELLS_AMBIENCE);
      bells.loop = true;
      bells.volume = Math.max(0.05, Math.min(1, this.volume * 0.32));
      this.routeAudioElementToRoom(bells, 0.65);
      this.fallbackBellsAudio = bells;
      bells.play().catch(() => {});
    } catch {}
  }

  public stopQuestionBellsAmbience() {
    if (this.activeBellsSource) {
      try {
        this.activeBellsSource.stop();
        this.activeBellsSource.disconnect();
      } catch {}
      this.activeBellsSource = null;
      this.activeBellsGain = null;
    }
    if (this.fallbackBellsAudio) {
      try {
        this.fallbackBellsAudio.pause();
        this.fallbackBellsAudio.currentTime = 0;
      } catch {}
      this.fallbackBellsAudio = null;
    }
  }

  // Clicking "MULAI MENJAWAB" (plays Victory Beat sparkle chime)
  public playStartAnswering() {
    if (this.activeBellsGain && this.ctx) {
      this.activeBellsGain.gain.setTargetAtTime(0.1, this.ctx.currentTime, 0.05);
    }
    if (this.fallbackBellsAudio) {
      this.fallbackBellsAudio.volume = Math.max(0.03, this.volume * 0.14);
    }
    this.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_BEAT_CHIME, 1.25);
  }

  // Normal countdown tick (10s down to 4s) and urgent red alert (3s, 2s, 1s)
  public playTick(urgent: boolean = false) {
    if (urgent) {
      this.playTone(987.77, 'sawtooth', 0.18, 0, 0.65);
      this.playTone(1318.5, 'triangle', 0.18, 0.03, 0.58);
    } else {
      this.playTone(784, 'triangle', 0.09, 0, 0.42);
      this.playTone(1568, 'sine', 0.05, 0, 0.25);
    }
  }

  // Main game 60-second warning pulse
  public playWarningPulse() {
    this.playTone(659.25, 'triangle', 0.16, 0, 0.52);
    this.playTone(523.25, 'triangle', 0.22, 0.14, 0.52);
  }

  // START GAME tournament fanfare (Grand Orchestral Hit + "Choose Your Champion!")
  public playStartGameFanfare() {
    this.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_ORCHESTRA_HIT, 1.35);
    setTimeout(() => {
      this.playChooseYourChampion();
    }, 550);
  }

  // CORRECT ANSWER celebration fanfare (Cycles through the uploaded Victory Trumpet & Brass MP3s!)
  public playCorrectAnswer(points: number = 10) {
    this.stopQuestionBellsAmbience();

    // Add a bright immediate triumphant chord strike + Studio MP3 fanfare
    this.playTone(523.25, 'triangle', 0.25, 0, 0.5);
    this.playTone(659.25, 'triangle', 0.25, 0.05, 0.5);
    this.playTone(783.99, 'triangle', 0.35, 0.1, 0.55);

    if (points >= 100) {
      this.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_ORCHESTRA_HIT, 1.4);
      setTimeout(() => {
        this.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_TRUMPET, 1.35);
      }, 420);
    } else if (points >= 50) {
      this.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_FANFARE_DOUBLE, 1.4);
    } else {
      const fanfarePool = [
        STUDIO_AUDIO_ASSETS.VICTORY_TRUMPET,
        STUDIO_AUDIO_ASSETS.VICTORY_BRASS_1,
        STUDIO_AUDIO_ASSETS.VICTORY_FANFARE_DOUBLE,
      ];
      const chosen = fanfarePool[this.correctFanfareIndex % fanfarePool.length];
      this.correctFanfareIndex++;
      this.playMp3(chosen, 1.35);
    }
  }

  // WRONG ANSWER buzzer — loud, unmistakable arena game-show buzzer with hall reverb
  public playWrongAnswer() {
    this.stopQuestionBellsAmbience();
    this.playTone(196, 'sawtooth', 0.32, 0, 0.72, 146.83);
    this.playTone(233.08, 'square', 0.32, 0, 0.55, 174.61);
    this.playTone(146.83, 'sawtooth', 0.48, 0.26, 0.78, 110);
    this.playTone(174.61, 'square', 0.48, 0.26, 0.58, 130.81);
  }

  // TIME'S UP alarm — loud stadium siren horn
  public playTimesUpAlarm() {
    this.stopQuestionBellsAmbience();
    for (let i = 0; i < 4; i++) {
      this.playTone(880, 'sawtooth', 0.13, i * 0.15, 0.68);
      this.playTone(622.25, 'square', 0.13, i * 0.15 + 0.065, 0.58);
    }
  }

  // GAME OVER dramatic transition sound
  public playGameOver() {
    this.stopQuestionBellsAmbience();
    this.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_ORCHESTRA_HIT, 1.4);
  }

  // FINAL RANKING Grand Championship Victory Fanfare & 37s Marching Anthem ("Victory At Last")
  public playChampionshipFanfare() {
    this.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_ORCHESTRA_HIT, 1.4);
  }

  public startVictoryAmbience() {
    this.stopVictoryAmbience();
    this.stopQuestionBellsAmbience();
    if (this.isMuted || this.volume <= 0 || typeof window === 'undefined') return;

    // Play immediate orchestral brass hit, followed by the full 37s "Victory At Last" championship anthem
    this.playMp3(STUDIO_AUDIO_ASSETS.VICTORY_ORCHESTRA_HIT, 1.35);

    const ctx = this.getContext();
    const decoded = this.decodedBuffers.get(STUDIO_AUDIO_ASSETS.CHAMPIONSHIP_ANTHEM);
    if (ctx && this.masterInput && decoded) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.loop = true;
        const gain = ctx.createGain();
        gain.gain.value = 0.72;
        source.connect(gain);
        gain.connect(this.masterInput);
        source.start(0);
        this.activeAnthemSource = source;
        this.activeAnthemGain = gain;
        return;
      } catch {}
    }

    try {
      const anthem = new Audio(STUDIO_AUDIO_ASSETS.CHAMPIONSHIP_ANTHEM);
      anthem.loop = true;
      anthem.volume = Math.max(0.1, Math.min(1, this.volume * 0.78));
      this.routeAudioElementToRoom(anthem, 0.95);
      this.fallbackAnthemAudio = anthem;
      anthem.play().catch(() => {});
    } catch {}
  }

  public stopVictoryAmbience() {
    if (this.activeAnthemSource) {
      try {
        this.activeAnthemSource.stop();
        this.activeAnthemSource.disconnect();
      } catch {}
      this.activeAnthemSource = null;
      this.activeAnthemGain = null;
    }
    if (this.fallbackAnthemAudio) {
      try {
        this.fallbackAnthemAudio.pause();
        this.fallbackAnthemAudio.currentTime = 0;
      } catch {}
      this.fallbackAnthemAudio = null;
    }
  }
}

export const soundEngine = new SoundEngine();
