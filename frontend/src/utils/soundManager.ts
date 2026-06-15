export class SoundManager {
  private ctx: AudioContext | null = null;
  private buffers: Record<string, AudioBuffer> = {};
  private muted: boolean = false;
  private volume: number = 0.7;
  private sources: Set<AudioBufferSourceNode> = new Set();
  
  // Fallback HTML5 Audio cache for unsupported environments
  private audioCache: Record<string, HTMLAudioElement> = {};
  private isFallback: boolean = false;

  constructor(muted: boolean, volume: number = 0.7) {
    this.muted = muted;
    this.volume = volume;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        this.isFallback = true;
      }
    } catch {
      this.isFallback = true;
    }
  }

  /**
   * Set muted state dynamically
   */
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.isFallback) {
      Object.values(this.audioCache).forEach((audio) => {
        audio.muted = muted;
      });
    } else {
      if (muted) {
        // Stop any active Web Audio node playing to silence immediately
        this.sources.forEach((src) => {
          try {
            src.stop();
          } catch {
            // ignore
          }
        });
        this.sources.clear();
      }
    }
  }

  /**
   * Set volume dynamically
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.isFallback) {
      Object.values(this.audioCache).forEach((audio) => {
        audio.volume = this.volume;
      });
    }
  }

  /**
   * Lazy initialization of the AudioContext
   */
  private init() {
    if (this.isFallback) return;
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
      } catch {
        this.isFallback = true;
      }
    }
  }

  /**
   * Try to resume/unlock the AudioContext within a user gesture
   */
  async unlock(): Promise<void> {
    if (this.isFallback) {
      // Warm up fallback HTML5 audio elements on mobile
      const promises = Object.values(this.audioCache).map((audio) => {
        audio.muted = this.muted;
        audio.volume = 0;
        return audio.play()
          .then(() => {
            audio.pause();
            audio.volume = this.volume;
            audio.currentTime = 0;
          })
          .catch(() => {});
      });
      await Promise.all(promises);
      return;
    }
    
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume().catch((err) => console.warn("AudioContext resume failed:", err));
    }
  }

  /**
   * Check if audio is successfully unlocked
   */
  isUnlocked(): boolean {
    if (this.isFallback) return true; // Fallback doesn't support state checking; assume active
    return !!(this.ctx && this.ctx.state === "running");
  }

  /**
   * Preload sound files
   */
  async preload(srcs: string[]): Promise<void> {
    if (this.isFallback) {
      srcs.forEach((src) => {
        if (!this.audioCache[src]) {
          const audio = new Audio(src);
          audio.muted = this.muted;
          audio.volume = this.volume;
          audio.preload = "auto";
          this.audioCache[src] = audio;
        }
      });
      return;
    }

    this.init();
    await Promise.all(srcs.map((src) => this.load(src)));
  }

  /**
   * Load and decode an audio source
   */
  private async load(src: string): Promise<AudioBuffer | null> {
    if (this.isFallback) return null;
    if (this.buffers[src]) return this.buffers[src];
    try {
      const resp = await fetch(src);
      const arrayBuf = await resp.arrayBuffer();
      this.init();
      if (!this.ctx) return null;
      const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
      this.buffers[src] = audioBuf;
      return audioBuf;
    } catch (e) {
      console.error("Failed to load/decode sound:", src, e);
      return null;
    }
  }

  /**
   * Play a sound file
   */
  play(src: string) {
    if (this.muted) return;

    if (this.isFallback) {
      const audio = this.audioCache[src] || new Audio(src);
      this.audioCache[src] = audio;
      audio.muted = this.muted;
      audio.volume = this.volume;
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }

    const buffer = this.buffers[src];
    if (buffer) {
      this.playBuffer(buffer);
    } else {
      // Dynamic fallback load if not preloaded yet
      this.load(src).then((buf) => {
        if (buf && !this.muted) {
          this.playBuffer(buf);
        }
      });
    }
  }

  /**
   * Connect and trigger Web Audio source buffer
   */
  private playBuffer(buffer: AudioBuffer) {
    if (!this.ctx || this.muted) return;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = this.muted ? 0 : this.volume;
      
      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      this.sources.add(source);
      source.onended = () => {
        this.sources.delete(source);
      };
      
      source.start(0);
    } catch (e) {
      console.warn("Web Audio play failed:", e);
    }
  }
}
