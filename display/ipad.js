(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    displayStart: "08:00",
    displayEnd: "22:00",
    transitionDurationMs: 1400,
    playlistRefreshMs: 5 * 60 * 1000,
    scheduleCheckMs: 30 * 1000,
    playlistPath: "/display/playlist.json",
  };

  const STORAGE_KEYS = {
    config: "sml-ipad-config",
    playlist: "sml-ipad-playlist",
  };

  const dom = {
    body: document.body,
    current: document.getElementById("slide-current"),
    next: document.getElementById("slide-next"),
    closedScreen: document.getElementById("closed-screen"),
    reopenTime: document.getElementById("reopen-time"),
    closedNow: document.getElementById("closed-now"),
  };

  class ConfigService {
    constructor(path) {
      this.path = path;
    }

    async load() {
      const network = await this.fetchNetwork();
      if (network) {
        this.saveLocal(network);
        return { ...DEFAULT_CONFIG, ...network };
      }

      const local = this.loadLocal();
      if (local) {
        return { ...DEFAULT_CONFIG, ...local };
      }

      return { ...DEFAULT_CONFIG };
    }

    async fetchNetwork() {
      try {
        const response = await fetch(`${this.path}?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return null;
        }

        return await response.json();
      } catch {
        return null;
      }
    }

    saveLocal(config) {
      try {
        localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
      } catch {
        // Intentionally ignored.
      }
    }

    loadLocal() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.config);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }
  }

  class PlaylistService {
    constructor(path) {
      this.path = path;
      this.lastSignature = "";
    }

    async loadInitial() {
      const fetched = await this.fetchPlaylist();
      if (fetched.slides.length) {
        return fetched;
      }

      const local = this.loadLocal();
      return local.slides.length ? local : fetched;
    }

    async fetchPlaylist() {
      try {
        const response = await fetch(`${this.path}?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Playlist HTTP error: ${response.status}`);
        }

        const data = await response.json();
        const slides = normalizeSlides(data.slides);
        const signature = JSON.stringify(slides);
        this.saveLocal(slides, signature);
        return { slides, signature };
      } catch {
        return this.loadLocal();
      }
    }

    saveLocal(slides, signature) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.playlist,
          JSON.stringify({ slides, signature }),
        );
      } catch {
        // Intentionally ignored.
      }
    }

    loadLocal() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.playlist);
        if (!raw) {
          return { slides: [], signature: "" };
        }

        const parsed = JSON.parse(raw);
        const slides = normalizeSlides(parsed.slides);
        return { slides, signature: JSON.stringify(slides) };
      } catch {
        return { slides: [], signature: "" };
      }
    }
  }

  class Slideshow {
    constructor() {
      this.currentEl = dom.current;
      this.nextEl = dom.next;
      this.transitionDurationMs = DEFAULT_CONFIG.transitionDurationMs;
      this.slides = [];
      this.currentIndex = -1;
      this.running = false;
      this.closed = false;
      this.slideTimer = null;
      this.fadeTimer = null;
    }

    setTransitionDuration(ms) {
      this.transitionDurationMs = ms;
      document.documentElement.style.setProperty(
        "--transition-fade-ms",
        String(ms),
      );
    }

    setSlides(slides) {
      const previousImage =
        this.currentIndex >= 0 ? this.slides[this.currentIndex].image : null;
      this.slides = [...slides];

      if (!this.slides.length) {
        this.stop();
        this.clearVisuals();
        return;
      }

      if (previousImage) {
        const matchIndex = this.slides.findIndex(
          (item) => item.image === previousImage,
        );
        this.currentIndex = matchIndex >= 0 ? matchIndex : 0;
      } else {
        this.currentIndex = 0;
      }

      this.renderCurrent();
      if (this.running && !this.closed) {
        this.scheduleNext();
      }
    }

    async start() {
      if (!this.slides.length || this.running) {
        return;
      }

      this.running = true;
      if (this.currentIndex < 0) {
        this.currentIndex = 0;
      }

      await this.ensureCurrentLoaded();
      this.renderCurrent();
      this.scheduleNext();
    }

    stop() {
      this.running = false;
      this.clearTimers();
    }

    setClosedState(closed) {
      this.closed = closed;
      if (closed) {
        this.clearTimers();
      } else if (this.running) {
        this.scheduleNext();
      }
    }

    clearTimers() {
      if (this.slideTimer) {
        clearTimeout(this.slideTimer);
        this.slideTimer = null;
      }

      if (this.fadeTimer) {
        clearTimeout(this.fadeTimer);
        this.fadeTimer = null;
      }
    }

    clearVisuals() {
      this.currentEl.style.backgroundImage = "none";
      this.nextEl.style.backgroundImage = "none";
      this.currentEl.style.opacity = "1";
      this.nextEl.style.opacity = "0";
    }

    async ensureCurrentLoaded() {
      const limit = this.slides.length;
      let tries = 0;

      while (tries < limit) {
        const ok = await preloadImage(this.slides[this.currentIndex].image);
        if (ok) {
          return true;
        }

        this.currentIndex = (this.currentIndex + 1) % this.slides.length;
        tries += 1;
      }

      return false;
    }

    renderCurrent() {
      if (!this.slides.length || this.currentIndex < 0) {
        return;
      }

      this.currentEl.style.backgroundImage = asBg(
        this.slides[this.currentIndex].image,
      );
      this.currentEl.style.opacity = "1";
      this.nextEl.style.opacity = "0";
    }

    scheduleNext() {
      this.clearTimers();
      if (!this.running || this.closed || this.slides.length <= 1) {
        return;
      }

      const duration = Math.max(
        3000,
        Math.floor(this.slides[this.currentIndex].duration * 1000),
      );
      this.slideTimer = setTimeout(() => {
        this.transition().catch(() => this.scheduleNext());
      }, duration);
    }

    async transition() {
      if (!this.running || this.closed || this.slides.length <= 1) {
        return;
      }

      const order = [];
      for (let i = 1; i < this.slides.length; i += 1) {
        order.push((this.currentIndex + i) % this.slides.length);
      }

      let target = -1;
      for (const index of order) {
        const ok = await preloadImage(this.slides[index].image);
        if (ok) {
          target = index;
          break;
        }
      }

      if (target < 0) {
        this.scheduleNext();
        return;
      }

      this.nextEl.style.backgroundImage = asBg(this.slides[target].image);
      this.nextEl.style.opacity = "1";
      this.currentEl.style.opacity = "0";

      this.fadeTimer = setTimeout(() => {
        const oldCurrent = this.currentEl;
        this.currentEl = this.nextEl;
        this.nextEl = oldCurrent;

        this.nextEl.style.opacity = "0";
        this.nextEl.style.backgroundImage = "none";

        this.currentIndex = target;
        this.scheduleNext();
      }, this.transitionDurationMs + 40);
    }
  }

  class Scheduler {
    constructor(config, slideshow) {
      this.config = config;
      this.slideshow = slideshow;
      this.timer = null;
      this.lastOpenState = null;
    }

    start() {
      this.tick();
      this.timer = setInterval(() => this.tick(), this.config.scheduleCheckMs);
    }

    stop() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }

    tick() {
      const open = isWithinHours(
        new Date(),
        this.config.displayStart,
        this.config.displayEnd,
      );
      if (open === this.lastOpenState) {
        return;
      }

      this.lastOpenState = open;
      if (open) {
        dom.body.classList.remove("is-closed");
        dom.closedScreen.classList.remove("active");
        dom.closedScreen.setAttribute("aria-hidden", "true");
        this.slideshow.setClosedState(false);
      } else {
        dom.reopenTime.textContent = formatOpenHoursLabel(
          this.config.displayStart,
          this.config.displayEnd,
        );
        dom.body.classList.add("is-closed");
        dom.closedScreen.classList.add("active");
        dom.closedScreen.setAttribute("aria-hidden", "false");
        this.slideshow.setClosedState(true);
      }
    }
  }

  class IpadApp {
    constructor() {
      this.config = { ...DEFAULT_CONFIG };
      this.configService = new ConfigService("/display/config.json");
      this.playlistService = null;
      this.slideshow = new Slideshow();
      this.scheduler = null;
      this.playlistTimer = null;
      this.closedClockTimer = null;
      this.refreshing = false;
    }

    async init() {
      this.config = await this.configService.load();
      this.slideshow.setTransitionDuration(this.config.transitionDurationMs);

      this.playlistService = new PlaylistService(this.config.playlistPath);
      const initial = await this.playlistService.loadInitial();
      this.playlistService.lastSignature = initial.signature;
      this.slideshow.setSlides(initial.slides);
      await this.slideshow.start();

      this.scheduler = new Scheduler(this.config, this.slideshow);
      this.scheduler.start();
      this.startClosedClock();

      this.playlistTimer = setInterval(() => {
        this.refreshPlaylist().catch(() => {
          // Keep running with existing playlist.
        });
      }, this.config.playlistRefreshMs);

      window.addEventListener("online", () => {
        this.refreshPlaylist().catch(() => {
          // Keep running with existing playlist.
        });
      });

      window.addEventListener("beforeunload", () => {
        if (this.playlistTimer) {
          clearInterval(this.playlistTimer);
          this.playlistTimer = null;
        }

        if (this.closedClockTimer) {
          clearInterval(this.closedClockTimer);
          this.closedClockTimer = null;
        }

        if (this.scheduler) {
          this.scheduler.stop();
        }

        this.slideshow.stop();
      });

      this.registerServiceWorker();
    }

    startClosedClock() {
      if (!dom.closedNow) {
        return;
      }

      if (this.closedClockTimer) {
        clearInterval(this.closedClockTimer);
      }

      const updateClock = () => {
        dom.closedNow.textContent = formatWelcomeTime(new Date());
      };

      updateClock();
      this.closedClockTimer = setInterval(updateClock, 30 * 1000);
    }

    async refreshPlaylist() {
      if (this.refreshing || !this.playlistService) {
        return;
      }

      this.refreshing = true;
      try {
        const result = await this.playlistService.fetchPlaylist();
        if (!result.slides.length) {
          return;
        }

        if (result.signature !== this.playlistService.lastSignature) {
          this.playlistService.lastSignature = result.signature;
          this.slideshow.setSlides(result.slides);
          await this.slideshow.start();
        }
      } finally {
        this.refreshing = false;
      }
    }

    async registerServiceWorker() {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return;
      }

      try {
        await navigator.serviceWorker.register("/display/sw.js");
      } catch {
        // Non-fatal.
      }
    }
  }

  function normalizeSlides(slides) {
    if (!Array.isArray(slides)) {
      return [];
    }

    return slides
      .map((slide) => {
        const image =
          slide && typeof slide.image === "string" ? slide.image.trim() : "";
        const duration = Number(slide && slide.duration);

        if (!image) {
          return null;
        }

        return {
          image,
          duration: Number.isFinite(duration) && duration > 0 ? duration : 12,
          type: slide && typeof slide.type === "string" ? slide.type : "image",
        };
      })
      .filter((slide) => slide && slide.type === "image");
  }

  function asBg(url) {
    const safe = String(url).replace(/"/g, '\\"');
    return `url("${safe}")`;
  }

  async function preloadImage(url) {
    return new Promise((resolve) => {
      const image = new Image();
      let done = false;

      const finish = (ok) => {
        if (done) {
          return;
        }

        done = true;
        image.onload = null;
        image.onerror = null;
        resolve(ok);
      };

      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = url;

      if (image.complete) {
        finish(image.naturalWidth > 0);
      }

      setTimeout(() => finish(false), 15000);
    });
  }

  function parseTimeToday(value, baseDate) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || "");
    if (!match) {
      return null;
    }

    const [, hh, mm] = match;
    const date = new Date(baseDate);
    date.setHours(Number(hh), Number(mm), 0, 0);
    return date.getTime();
  }

  function isWithinHours(now, startTime, endTime) {
    const start = parseTimeToday(startTime, now);
    const end = parseTimeToday(endTime, now);
    const current = now.getTime();

    if (!start || !end) {
      return true;
    }

    if (start <= end) {
      return current >= start && current < end;
    }

    return current >= start || current < end;
  }

  function formatTime(time24h) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time24h || "");
    if (!match) {
      return "8:00 AM";
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const suffix = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  function formatOpenHoursLabel(startTime24h, endTime24h) {
    return `Open Everyday: ${formatTime(startTime24h)} to ${formatTime(endTime24h)}`;
  }

  function formatWelcomeTime(date) {
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return `${timeFormatter.format(date)} • ${dateFormatter.format(date)}`;
  }

  const app = new IpadApp();
  app.init().catch((error) => {
    console.error("iPad display failed to initialize:", error);
  });
})();
