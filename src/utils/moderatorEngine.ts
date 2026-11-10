import { QuestionItem, GAME_IDENTITY } from '../data/defaultQuestions';
import { soundEngine } from './soundEngine';

export type ModeratorVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Zephyr' | 'Fenrir';
export type ModeratorAcousticFx = 'ROBOT_ARENA' | 'ARENA_HALL' | 'CYBER_ROBOT' | 'STUDIO_CLEAN';

export interface ModeratorVoiceOption {
  id: ModeratorVoiceName;
  label: string;
  persona: string;
  pitch: number;
  rate: number;
}

export interface ModeratorFxOption {
  id: ModeratorAcousticFx;
  label: string;
  description: string;
}

export const MODERATOR_FX_MODES: ModeratorFxOption[] = [
  {
    id: 'ROBOT_ARENA',
    label: 'Robot AI + Gema Dalam Ruangan (Aula)',
    description: 'Kombinasi suara Robot AI dengan pantulan gema dalam ruangan kompetisi megah',
  },
  {
    id: 'ARENA_HALL',
    label: 'Suara Dalam Ruangan (Gema Aula Stadion)',
    description: 'Efek akustik mikrofon dalam ruangan besar / aula dengan pantulan gema (reverb)',
  },
  {
    id: 'CYBER_ROBOT',
    label: 'Suara Robot AI (Cyber Vocoder)',
    description: 'Efek modulasi suara robot masa depan dengan frekuensi metalik',
  },
  {
    id: 'STUDIO_CLEAN',
    label: 'Studio Jernih (Tanpa Gema)',
    description: 'Suara standar jernih tanpa pantulan ruangan atau modulasi robot',
  },
];

export const MODERATOR_VOICES: ModeratorVoiceOption[] = [
  {
    id: 'Kore',
    label: 'Kore (AI Commander)',
    persona: 'Moderator Utama Arena & Tegas',
    pitch: 0.92,
    rate: 1.02,
  },
  {
    id: 'Fenrir',
    label: 'Fenrir (Mega Robot)',
    persona: 'Suara Robot Berat & Menggelegar',
    pitch: 0.68,
    rate: 0.98,
  },
  {
    id: 'Charon',
    label: 'Charon (Hall Announcer)',
    persona: 'Suara Bariton Gema Dalam Ruangan',
    pitch: 0.78,
    rate: 0.95,
  },
  {
    id: 'Puck',
    label: 'Puck (Cyber Droid)',
    persona: 'Robot Cepat & Antusias',
    pitch: 1.22,
    rate: 1.08,
  },
  {
    id: 'Zephyr',
    label: 'Zephyr (Holo Assistant)',
    persona: 'Asisten Hologram Futuristik',
    pitch: 1.08,
    rate: 1.0,
  },
];

export interface ModeratorStateSnapshot {
  enabled: boolean;
  voiceName: ModeratorVoiceName;
  fxMode: ModeratorAcousticFx;
  autoReadQuestion: boolean;
  isSpeaking: boolean;
  isLoading: boolean;
  currentSubtitle: string;
  lastError: string | null;
}

type Listener = (state: ModeratorStateSnapshot) => void;

class ModeratorEngine {
  private enabled: boolean = true;
  private voiceName: ModeratorVoiceName = 'Kore';
  private fxMode: ModeratorAcousticFx = 'ROBOT_ARENA';
  private autoReadQuestion: boolean = true;
  private isSpeaking: boolean = false;
  private isLoading: boolean = false;
  private currentSubtitle: string =
    'Moderator AI & Efek Suara Dalam Ruangan aktif di seluruh menu Class of Champions!';
  private lastError: string | null = null;

  private currentAudio: HTMLAudioElement | null = null;
  private audioCache = new Map<string, string>();
  private listeners = new Set<Listener>();
  private activeRequestId: number = 0;
  private serverQuotaCooldownUntil: number = 0;
  private pendingSpeakTimeout: number | null = null;

  // Web Audio API DSP Context for Hall Reverb & Robotic Vocoder FX
  private dspCtx: AudioContext | null = null;
  private impulseBuffer: AudioBuffer | null = null;
  private speechPulseTimer: number | null = null;

  constructor() {
    try {
      const savedEnabled = localStorage.getItem('coc_mod_enabled');
      const savedVoice = localStorage.getItem('coc_mod_voice') as ModeratorVoiceName | null;
      const savedFx = localStorage.getItem('coc_mod_fx') as ModeratorAcousticFx | null;
      const savedAutoRead = localStorage.getItem('coc_mod_autoread');
      if (savedEnabled !== null) this.enabled = JSON.parse(savedEnabled);
      if (savedVoice && MODERATOR_VOICES.some((v) => v.id === savedVoice)) {
        this.voiceName = savedVoice;
      }
      if (savedFx && MODERATOR_FX_MODES.some((f) => f.id === savedFx)) {
        this.fxMode = savedFx;
      }
      if (savedAutoRead !== null) this.autoReadQuestion = JSON.parse(savedAutoRead);
    } catch {}

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
      } catch {}
    }
  }

  private getDspContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.dspCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.dspCtx = new AudioCtx();
      }
    }
    if (this.dspCtx && this.dspCtx.state === 'suspended') {
      this.dspCtx.resume().catch(() => {});
    }
    return this.dspCtx;
  }

  // Generate a realistic Large Competition Hall / Stadium Impulse Response for ConvolverNode
  private getHallImpulseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.impulseBuffer) return this.impulseBuffer;
    const sampleRate = ctx.sampleRate;
    const duration = 2.2; // 2.2 second spacious indoor arena reverb tail
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2.2);
        const earlyEcho =
          i === Math.floor(sampleRate * 0.032) ||
          i === Math.floor(sampleRate * 0.068) ||
          i === Math.floor(sampleRate * 0.115)
            ? 0.72
            : 1.0;
        channelData[i] = (Math.random() * 2 - 1) * decay * earlyEcho * 0.5;
      }
    }
    this.impulseBuffer = impulse;
    return impulse;
  }

  // Play Stadium PA Mic Chime / Sci-Fi Robot Activation Tone with Hall Echo
  private playModeratorMicIntro(isStart: boolean = true) {
    if (soundEngine.getMuted() || this.fxMode === 'STUDIO_CLEAN') return;
    const ctx = this.getDspContext();
    if (!ctx) return;

    const vol = soundEngine.getVolume();
    if (vol <= 0) return;

    const now = ctx.currentTime;
    const useRobot = this.fxMode === 'CYBER_ROBOT' || this.fxMode === 'ROBOT_ARENA';
    const useHall =
      this.fxMode === 'ARENA_HALL' ||
      this.fxMode === 'ROBOT_ARENA' ||
      soundEngine.getRoomPreset() !== 'STUDIO_JERNIH';

    const masterGain = ctx.createGain();
    masterGain.gain.value = Math.min(1, vol * 0.32);
    masterGain.connect(ctx.destination);

    if (useHall) {
      const convolver = ctx.createConvolver();
      convolver.buffer = this.getHallImpulseBuffer(ctx);
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.8;
      masterGain.connect(convolver);
      convolver.connect(reverbGain);
      reverbGain.connect(ctx.destination);
    }

    if (useRobot) {
      const freqs = isStart ? [523.25, 783.99, 1046.5] : [783.99, 523.25];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + idx * 0.045);
        g.gain.setValueAtTime(0.001, now + idx * 0.045);
        g.gain.linearRampToValueAtTime(0.4, now + idx * 0.045 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.09);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.1);
      });
    } else if (useHall && isStart) {
      const chimeNotes = [
        { f: 587.33, t: 0, d: 0.22 },
        { f: 880.0, t: 0.14, d: 0.38 },
      ];
      chimeNotes.forEach((n) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        g.gain.setValueAtTime(0.001, now + n.t);
        g.gain.linearRampToValueAtTime(0.5, now + n.t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.02);
      });
    }
  }

  // Trigger a synchronized Vocoder / Indoor Room Acoustic Resonance pulse on syllable boundaries
  private triggerWordAcousticPulse() {
    if (soundEngine.getMuted() || this.fxMode === 'STUDIO_CLEAN') return;
    const ctx = this.getDspContext();
    if (!ctx) return;

    const vol = soundEngine.getVolume();
    if (vol <= 0) return;

    const now = ctx.currentTime;
    const useRobot = this.fxMode === 'CYBER_ROBOT' || this.fxMode === 'ROBOT_ARENA';
    const useHall =
      this.fxMode === 'ARENA_HALL' ||
      this.fxMode === 'ROBOT_ARENA' ||
      soundEngine.getRoomPreset() !== 'STUDIO_JERNIH';

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const persona = MODERATOR_VOICES.find((v) => v.id === this.voiceName) || MODERATOR_VOICES[0];
    const baseFreq = useRobot ? 115 * persona.pitch : 175 * persona.pitch;

    osc.type = useRobot ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(baseFreq + (Math.random() * 18 - 9), now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(useRobot ? 960 : 540, now);
    filter.Q.setValueAtTime(useRobot ? 5.5 : 2.2, now);

    const pulseLevel = vol * (useRobot ? 0.075 : 0.05);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(pulseLevel, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    if (useHall) {
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.11;
      const echoGain = ctx.createGain();
      echoGain.gain.value = 0.55;
      gain.connect(delay);
      delay.connect(echoGain);
      echoGain.connect(ctx.destination);
    }

    osc.start(now);
    osc.stop(now + 0.17);
  }

  private stopSpeechPulseLoop() {
    if (this.speechPulseTimer !== null) {
      clearInterval(this.speechPulseTimer);
      this.speechPulseTimer = null;
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): ModeratorStateSnapshot {
    return {
      enabled: this.enabled,
      voiceName: this.voiceName,
      fxMode: this.fxMode,
      autoReadQuestion: this.autoReadQuestion,
      isSpeaking: this.isSpeaking,
      isLoading: this.isLoading,
      currentSubtitle: this.currentSubtitle,
      lastError: this.lastError,
    };
  }

  private notify() {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    try {
      localStorage.setItem('coc_mod_enabled', JSON.stringify(val));
    } catch {}
    if (!val) {
      this.stop();
    }
    this.notify();
  }

  public setVoiceName(voice: ModeratorVoiceName) {
    this.voiceName = voice;
    try {
      localStorage.setItem('coc_mod_voice', voice);
    } catch {}
    this.notify();
  }

  public setFxMode(fx: ModeratorAcousticFx, syncSoundEngine: boolean = true) {
    this.fxMode = fx;
    try {
      localStorage.setItem('coc_mod_fx', fx);
    } catch {}

    // Keep global Indoor Room Sound Effects in sync across all menus!
    if (syncSoundEngine) {
      if (fx === 'ARENA_HALL') {
        soundEngine.setRoomPreset('AULA_BESAR', true);
      } else if (fx === 'ROBOT_ARENA') {
        soundEngine.setRoomPreset('STADION_MEGA', true);
      } else if (fx === 'CYBER_ROBOT') {
        soundEngine.setRoomPreset('RUANG_KELAS', true);
      } else if (fx === 'STUDIO_CLEAN') {
        soundEngine.setRoomPreset('STUDIO_JERNIH', true);
      }
    }

    this.notify();
  }

  public setAutoReadQuestion(val: boolean) {
    this.autoReadQuestion = val;
    try {
      localStorage.setItem('coc_mod_autoread', JSON.stringify(val));
    } catch {}
    this.notify();
  }

  public stop() {
    this.activeRequestId++;
    if (this.pendingSpeakTimeout !== null) {
      clearTimeout(this.pendingSpeakTimeout);
      this.pendingSpeakTimeout = null;
    }
    this.stopSpeechPulseLoop();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.isSpeaking = false;
    this.isLoading = false;
    this.notify();
  }

  // Connect HTMLAudioElement (from Gemini TTS WAV) through Web Audio API Hall Reverb + Robot Vocoder DSP graph!
  private routeAudioElementThroughDsp(audio: HTMLAudioElement) {
    if (this.fxMode === 'STUDIO_CLEAN' && soundEngine.getRoomPreset() === 'STUDIO_JERNIH') return;
    const ctx = this.getDspContext();
    if (!ctx) return;

    try {
      const source = ctx.createMediaElementSource(audio);
      const useRobot = this.fxMode === 'CYBER_ROBOT' || this.fxMode === 'ROBOT_ARENA';
      const useHall =
        this.fxMode === 'ARENA_HALL' ||
        this.fxMode === 'ROBOT_ARENA' ||
        soundEngine.getRoomPreset() !== 'STUDIO_JERNIH';

      let lastNode: AudioNode = source;

      if (useRobot) {
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 180;

        const metallicPeak = ctx.createBiquadFilter();
        metallicPeak.type = 'peaking';
        metallicPeak.frequency.value = 1150;
        metallicPeak.Q.value = 3.5;
        metallicPeak.gain.value = 8;

        const robotCombDelay = ctx.createDelay(0.1);
        robotCombDelay.delayTime.value = 0.018;
        const combFeedback = ctx.createGain();
        combFeedback.gain.value = 0.42;

        source.connect(highpass);
        highpass.connect(metallicPeak);

        metallicPeak.connect(robotCombDelay);
        robotCombDelay.connect(combFeedback);
        combFeedback.connect(robotCombDelay);

        const robotMix = ctx.createGain();
        metallicPeak.connect(robotMix);
        robotCombDelay.connect(robotMix);

        lastNode = robotMix;
      }

      // Boosted Dry Path for crystal clarity
      const dryGain = ctx.createGain();
      dryGain.gain.value = 1.2;
      lastNode.connect(dryGain);
      dryGain.connect(ctx.destination);

      if (useHall) {
        const echoDelay = ctx.createDelay(1.0);
        echoDelay.delayTime.value = 0.125;
        const echoFeedback = ctx.createGain();
        echoFeedback.gain.value = 0.34;
        const echoWet = ctx.createGain();
        echoWet.gain.value = 0.42;

        lastNode.connect(echoDelay);
        echoDelay.connect(echoFeedback);
        echoFeedback.connect(echoDelay);
        echoDelay.connect(echoWet);
        echoWet.connect(ctx.destination);

        const convolver = ctx.createConvolver();
        convolver.buffer = this.getHallImpulseBuffer(ctx);
        const reverbWet = ctx.createGain();
        reverbWet.gain.value = 0.65;

        lastNode.connect(convolver);
        convolver.connect(reverbWet);
        reverbWet.connect(ctx.destination);
      }
    } catch {
      // Standard audio output plays cleanly if MediaElementSource cannot attach
    }
  }

  // Instant Indonesian Speech Synthesis with Hall Echo & Robotic Vocoder Layers
  private speakViaBrowserFallback(text: string, reqId: number) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.isSpeaking = false;
      this.isLoading = false;
      this.notify();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      this.stopSpeechPulseLoop();

      const personaConfig =
        MODERATOR_VOICES.find((v) => v.id === this.voiceName) || MODERATOR_VOICES[0];

      const useRobot = this.fxMode === 'CYBER_ROBOT' || this.fxMode === 'ROBOT_ARENA';
      const useHall =
        this.fxMode === 'ARENA_HALL' ||
        this.fxMode === 'ROBOT_ARENA' ||
        soundEngine.getRoomPreset() !== 'STUDIO_JERNIH';

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';

      if (useRobot) {
        utterance.pitch = Math.max(0.5, Math.min(1.5, personaConfig.pitch * 0.85));
        utterance.rate = personaConfig.rate * 1.03;
      } else if (useHall) {
        utterance.pitch = personaConfig.pitch * 0.95;
        utterance.rate = personaConfig.rate * 0.97;
      } else {
        utterance.pitch = personaConfig.pitch;
        utterance.rate = personaConfig.rate;
      }

      utterance.volume = soundEngine.getMuted() ? 0 : Math.min(1, soundEngine.getVolume() * 1.0);

      const voices = window.speechSynthesis.getVoices();
      const idVoices = voices.filter(
        (v) =>
          v.lang.toLowerCase().includes('id-id') ||
          v.lang.toLowerCase().includes('id_') ||
          v.name.toLowerCase().includes('indonesia')
      );
      if (idVoices.length > 0) {
        utterance.voice = idVoices[0];
      }

      utterance.onboundary = () => {
        if (this.activeRequestId !== reqId) return;
        this.triggerWordAcousticPulse();
      };

      utterance.onstart = () => {
        if (this.activeRequestId !== reqId) return;
        this.isLoading = false;
        this.isSpeaking = true;
        this.playModeratorMicIntro(true);
        if (this.fxMode !== 'STUDIO_CLEAN') {
          this.speechPulseTimer = window.setInterval(() => {
            if (!this.isSpeaking || this.activeRequestId !== reqId) {
              this.stopSpeechPulseLoop();
              return;
            }
            this.triggerWordAcousticPulse();
          }, 190);
        }
        this.notify();
      };

      utterance.onend = () => {
        if (this.activeRequestId !== reqId) return;
        this.stopSpeechPulseLoop();
        this.playModeratorMicIntro(false);
        this.isSpeaking = false;
        this.notify();
      };

      utterance.onerror = () => {
        if (this.activeRequestId !== reqId) return;
        this.stopSpeechPulseLoop();
        this.isSpeaking = false;
        this.isLoading = false;
        this.notify();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      this.stopSpeechPulseLoop();
      this.isSpeaking = false;
      this.isLoading = false;
      this.notify();
    }
  }

  private playAudioDataUri(dataUri: string, reqId: number) {
    if (this.activeRequestId !== reqId) return;
    if (soundEngine.getMuted()) {
      this.isLoading = false;
      this.isSpeaking = false;
      this.notify();
      return;
    }

    const audio = new Audio(dataUri);
    audio.volume = Math.max(0.15, Math.min(1, soundEngine.getVolume()));
    this.currentAudio = audio;

    this.routeAudioElementThroughDsp(audio);

    audio.onplay = () => {
      if (this.activeRequestId !== reqId) return;
      this.isLoading = false;
      this.isSpeaking = true;
      this.playModeratorMicIntro(true);
      this.notify();
    };

    audio.onended = () => {
      if (this.activeRequestId !== reqId) return;
      this.playModeratorMicIntro(false);
      this.isSpeaking = false;
      this.currentAudio = null;
      this.notify();
    };

    audio.onerror = () => {
      if (this.activeRequestId !== reqId) return;
      this.isSpeaking = false;
      this.isLoading = false;
      this.currentAudio = null;
      this.notify();
    };

    audio.play().catch(() => {
      this.speakViaBrowserFallback(this.currentSubtitle, reqId);
    });
  }

  public async speak(text: string, style?: string, delayMs: number = 0) {
    if (!this.enabled || soundEngine.getMuted()) {
      this.currentSubtitle = text;
      this.notify();
      return;
    }

    this.stop();
    const reqId = ++this.activeRequestId;
    this.currentSubtitle = text;
    this.lastError = null;
    this.notify();

    if (delayMs > 0) {
      await new Promise<void>((resolve) => {
        this.pendingSpeakTimeout = window.setTimeout(() => {
          this.pendingSpeakTimeout = null;
          resolve();
        }, delayMs);
      });
      if (this.activeRequestId !== reqId) return;
    }

    const spokenText = text
      .replace(/×/g, ' dikali ')
      .replace(/÷/g, ' dibagi ')
      .replace(/\.\.\./g, ' titik-titik ')
      .replace(/4\s*\/\s*Fase\s*B/gi, '4 Fase B')
      .replace(/4\/B/g, '4 Fase B');

    const cacheKey = `${this.voiceName}::${spokenText}`;
    const cachedUri = this.audioCache.get(cacheKey);
    if (cachedUri) {
      this.playAudioDataUri(cachedUri, reqId);
      return;
    }

    if (Date.now() < this.serverQuotaCooldownUntil) {
      this.speakViaBrowserFallback(spokenText, reqId);
      return;
    }

    this.isLoading = true;
    this.notify();

    try {
      const response = await fetch('/api/moderator/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: spokenText,
          voiceName: this.voiceName,
          style:
            style ||
            'Futuristic robotic stadium announcer and charismatic Indonesian academic tournament host in a large arena hall',
        }),
      });

      if (this.activeRequestId !== reqId) return;

      const data = await response.json().catch(() => ({}));
      if (this.activeRequestId !== reqId) return;

      if (data.quotaCooldownActive) {
        this.serverQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
      }

      if (data.audioBase64) {
        const mime = data.mimeType || 'audio/wav';
        const dataUri = `data:${mime};base64,${data.audioBase64}`;
        this.audioCache.set(cacheKey, dataUri);
        this.playAudioDataUri(dataUri, reqId);
      } else {
        this.speakViaBrowserFallback(spokenText, reqId);
      }
    } catch {
      if (this.activeRequestId !== reqId) return;
      this.speakViaBrowserFallback(spokenText, reqId);
    }
  }

  public async speakLiveCommentary(
    eventType: string,
    contextData: Record<string, unknown>,
    fallbackText: string
  ) {
    if (!this.enabled || soundEngine.getMuted()) {
      this.currentSubtitle = fallbackText;
      this.notify();
      return;
    }

    this.stop();
    const reqId = ++this.activeRequestId;
    this.currentSubtitle = fallbackText;
    this.isLoading = true;
    this.lastError = null;
    this.notify();

    try {
      const response = await fetch('/api/moderator/commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          contextData,
          voiceName: this.voiceName,
        }),
      });

      if (this.activeRequestId !== reqId) return;

      const data = await response.json().catch(() => ({}));
      if (this.activeRequestId !== reqId) return;

      if (data.quotaCooldownActive) {
        this.serverQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
      }

      const finalScript = data.script || fallbackText;
      this.currentSubtitle = finalScript;
      this.notify();

      if (data.audioBase64) {
        const mime = data.mimeType || 'audio/wav';
        const dataUri = `data:${mime};base64,${data.audioBase64}`;
        this.playAudioDataUri(dataUri, reqId);
      } else {
        const spokenScript = finalScript
          .replace(/×/g, ' dikali ')
          .replace(/÷/g, ' dibagi ')
          .replace(/4\s*\/\s*Fase\s*B/gi, '4 Fase B')
          .replace(/4\/B/g, '4 Fase B');
        this.speakViaBrowserFallback(spokenScript, reqId);
      }
    } catch {
      if (this.activeRequestId !== reqId) return;
      this.speakViaBrowserFallback(fallbackText, reqId);
    }
  }

  // === Pre-configured Game Show Host Announcements ===
  // Notice the short delayMs when paired with major Sound Effects so the SFX is heard 100% clearly first!

  public announceWelcome() {
    this.speak(
      `Sistem Moderator A-I Aktif. Selamat datang di arena kompetisi akademik Class of Champions! Hari ini kita akan bertanding pada mata pelajaran ${GAME_IDENTITY.mataPelajaran}, materi ${GAME_IDENTITY.materi}, untuk Kelas ${GAME_IDENTITY.kelas}. Siapkan strategi dan kekompakan tim kalian!`
    );
  }

  public announceStartGame(teamCount: number, durationMinutes: number, teamNames: string[]) {
    const namesJoined = teamNames.slice(0, 4).join(', ');
    // Delay 1250ms so the Orchestra Hit + "Choose Your Champion!" MP3 plays loud and clear first!
    this.speak(
      `Perhatian di seluruh arena! Pertandingan Class of Champions mata pelajaran ${GAME_IDENTITY.mataPelajaran} materi ${GAME_IDENTITY.materi} Kelas ${GAME_IDENTITY.kelas} resmi dimulai! ${teamCount} tim yaitu ${namesJoined} akan memperebutkan 40 kotak soal dalam waktu ${durationMinutes} menit. Selamat bertanding!`,
      undefined,
      1250
    );
  }

  public announceQuestionOpened(q: QuestionItem, forceRead: boolean = false) {
    if (!this.autoReadQuestion && !forceRead) {
      this.currentSubtitle = `Kotak Nomor ${q.id} (${q.points} Poin): ${q.question}`;
      this.notify();
      return;
    }
    // Delay 550ms when box first opens so the Victory Beat Chime sound effect is heard clearly!
    this.speak(
      `Membuka kotak soal nomor ${q.id}, bobot ${q.points} poin. Perhatikan pertanyaannya: ${q.question}`,
      undefined,
      forceRead ? 0 : 550
    );
  }

  public announceTeamAnswering(teamName: string) {
    // Delay 450ms so the Start Answering chime rings clearly first
    this.speak(
      `Target terkunci pada ${teamName}. Waktu 10 detik dimulai sekarang!`,
      undefined,
      450
    );
  }

  public announceCorrectAnswer(teamName: string, points: number, totalScore: number) {
    // Delay 800ms so the Victory Trumpet / Brass Fanfare MP3 is heard loud & clear first!
    this.speak(
      `Verifikasi sukses! Jawaban benar untuk ${teamName}! Tambahan ${points} poin, total skor kini mencapai ${totalScore} poin!`,
      undefined,
      800
    );
  }

  public announceWrongAnswer(teamName: string) {
    // Delay 650ms so the Wrong Answer Arena Buzzer is heard loud & clear first!
    this.speak(
      `Verifikasi gagal! Jawaban dari ${teamName} belum tepat! Kotak soal ini kembali dibuka untuk tim lainnya!`,
      undefined,
      650
    );
  }

  public announceTimesUp(teamName: string) {
    // Delay 650ms so the Time's Up Siren Alarm is heard loud & clear first!
    this.speak(
      `Waktu habis! Sepuluh detik telah berlalu untuk ${teamName}. Soal kembali tersedia di arena!`,
      undefined,
      650
    );
  }

  public announceOneMinuteWarning(leaderName?: string) {
    const leadInfo = leaderName ? ` Saat ini posisi puncak dipimpin oleh ${leaderName}.` : '';
    this.speak(
      `Peringatan sistem! Waktu pertandingan tersisa 60 detik terakhir!${leadInfo} Ayo rebut kotak soal yang tersisa!`,
      undefined,
      350
    );
  }

  public announceFinalRanking(winnerNames: string[], topScore: number, isTie: boolean) {
    if (isTie) {
      this.speak(
        `Pertandingan selesai! Terjadi seri di posisi puncak antara ${winnerNames.join(
          ' dan '
        )} dengan perolehan ${topScore} poin! Selamat kepada seluruh juara Class of Champions!`,
        undefined,
        900
      );
    } else {
      this.speak(
        `Pertandingan Class of Champions resmi berakhir! Selamat kepada Juara Pertama kita, ${winnerNames[0]}, yang berhasil meraih podium tertinggi dengan total ${topScore} poin! Tepuk tangan meriah di seluruh arena untuk Kelas ${GAME_IDENTITY.kelas}!`,
        undefined,
        900
      );
    }
  }
}

export const moderatorEngine = new ModeratorEngine();
