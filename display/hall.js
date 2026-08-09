(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    displayStart: "08:00",
    displayEnd: "20:00",
    rotationDeg: 90,
    transitionDurationMs: 1400,
    playlistRefreshMs: 300000,
    scheduleCheckMs: 30000,
    playlistPath: "/display/playlist.json",
    calendarPath: "/2026-events.json",
    calendarYear: 2026,
    calendarMaxItems: 7,
    qr: {
      connectPath: "/connect-with-us.html",
      channelParamName: "channel",
      channelParamValue: "whatsapp",
      whatsappParamName: "wa",
      whatsappJoinUrl: "https://chat.whatsapp.com/KrcrKvWEe8u686as5Hkuaw",
      qrPixelSize: 360,
    },
    placeholders: {
      info: [
        "Hours:\n8:00 AM - 8:00 PM Everyday",
        "Aarti:\n7:00 PM Everyday",
        "E-transfer Donation Email:\n donate@laxmimandir.com",
        "2026 Calendar:\nlaxmimandir.com/2026-calendar",
      ],
      calendar: ["1....Event 1", "2....Event 2"],
      qrLabel: "QR",
      qrCaption: "Scan for",
      qrPlatformsLabel: "WhatsApp • Instagram • Facebook",
      announcement:
        "Acharya Shukla: 905-531-6985 | 370 Highway 8 Stoney Creek, ON Canada L8G1E9 | laxmimandir.com\nPlease maintain silence inside the mandir hall. Please do not touch the murtis.",
    },
    theme: {
      primary: "#530595",
      accent: "#f7cc20",
      background: "#170622",
    },
  };

  const STORAGE_KEYS = {
    config: "sml-display-config",
    playlist: "sml-display-playlist",
    calendar: "sml-display-calendar",
  };

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const DAY_NAMES_FULL = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const dom = {
    app: document.getElementById("app"),
    rotatedStage: document.getElementById("rotated-stage"),
    slideCurrent: document.getElementById("slide-current"),
    slideNext: document.getElementById("slide-next"),
    closedScreen: document.getElementById("closed-screen"),
    reopenTime: document.getElementById("reopen-time"),
    info: document.getElementById("info-placeholder"),
    calendarHeading: document.getElementById("calendar-heading"),
    calendar: document.getElementById("calendar-placeholder"),
    qrPlaceholder: document.getElementById("qr-placeholder"),
    announcement: document.getElementById("announcement-placeholder"),
    welcomeClock: document.getElementById("welcome-clock"),
    posterBadgeCurrent: document.getElementById("poster-badge-current"),
    posterBadgeNext: document.getElementById("poster-badge-next"),
  };

  class CalendarService {
    constructor(path, year) {
      this.path = path;
      this.year = year;
    }

    async loadUpcoming(maxItems) {
      const fromNetwork = await this.fetchNetworkCalendar();
      if (fromNetwork) {
        this.saveLocal(fromNetwork);
        return getUpcomingCalendarItems(fromNetwork, this.year, maxItems);
      }

      const fromLocal = this.loadLocal();
      if (fromLocal) {
        return getUpcomingCalendarItems(fromLocal, this.year, maxItems);
      }

      return [];
    }

    async fetchNetworkCalendar() {
      try {
        const response = await fetch(`${this.path}?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return null;
        }

        const json = await response.json();
        return json && typeof json === "object" ? json : null;
      } catch (error) {
        console.warn("Calendar fetch failed, using local fallback:", error);
        return null;
      }
    }

    saveLocal(calendarData) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.calendar,
          JSON.stringify(calendarData),
        );
      } catch (error) {
        console.warn("Failed caching calendar data:", error);
      }
    }

    loadLocal() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.calendar);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (error) {
        console.warn("Failed reading calendar data from localStorage:", error);
        return null;
      }
    }
  }

  class ConfigService {
    constructor(path) {
      this.path = path;
    }

    async load() {
      const fromNetwork = await this.fetchNetworkConfig();
      if (fromNetwork) {
        this.saveLocal(fromNetwork);
        return mergeConfig(DEFAULT_CONFIG, fromNetwork);
      }

      const fromStorage = this.loadLocal();
      if (fromStorage) {
        return mergeConfig(DEFAULT_CONFIG, fromStorage);
      }

      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }

    async fetchNetworkConfig() {
      try {
        const response = await fetch(`${this.path}?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return null;
        }

        return await response.json();
      } catch (error) {
        console.warn("Using local config fallback:", error);
        return null;
      }
    }

    saveLocal(config) {
      try {
        localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
      } catch (error) {
        console.warn("Failed saving config to localStorage:", error);
      }
    }

    loadLocal() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.config);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn("Failed reading config from localStorage:", error);
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
      const data = await this.fetchPlaylist();
      if (data.slides.length) {
        return data;
      }

      const stored = this.loadLocal();
      if (stored.slides.length) {
        return stored;
      }

      return data;
    }

    async fetchPlaylist() {
      try {
        const response = await fetch(`${this.path}?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Playlist HTTP error: ${response.status}`);
        }

        const json = await response.json();
        const slides = normalizeSlides(json.slides);
        const signature = getSignature(slides);
        this.saveLocal(slides, signature);

        return { slides, signature, source: "network" };
      } catch (error) {
        console.warn(
          "Playlist fetch failed, falling back to local cache:",
          error,
        );
        const fallback = this.loadLocal();
        return {
          slides: fallback.slides,
          signature: fallback.signature,
          source: "local",
        };
      }
    }

    saveLocal(slides, signature) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.playlist,
          JSON.stringify({ slides, signature, savedAt: Date.now() }),
        );
      } catch (error) {
        console.warn("Failed caching playlist:", error);
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
        return { slides, signature: getSignature(slides) };
      } catch (error) {
        console.warn("Failed reading local playlist:", error);
        return { slides: [], signature: "" };
      }
    }
  }

  class SlideshowEngine {
    constructor(options) {
      this.currentEl = options.currentEl;
      this.nextEl = options.nextEl;
      this.currentBadgeEl = options.currentBadgeEl;
      this.nextBadgeEl = options.nextBadgeEl;
      this.transitionDurationMs = options.transitionDurationMs;
      this.defaultDurationSec = options.defaultDurationSec;

      this.slides = [];
      this.currentIndex = -1;
      this.isRunning = false;
      this.isClosed = false;
      this.slideTimer = null;
      this.transitionTimer = null;
    }

    setTransitionDuration(ms) {
      this.transitionDurationMs = ms;
      document.documentElement.style.setProperty(
        "--transition-fade-ms",
        String(ms),
      );
    }

    setSlides(nextSlides) {
      const previousSlide =
        this.currentIndex >= 0 ? this.slides[this.currentIndex] : null;
      const previousImage = previousSlide ? previousSlide.image : null;
      this.slides = [...nextSlides];

      if (!this.slides.length) {
        this.stop();
        this.clearVisuals();
        return;
      }

      if (previousImage) {
        const sameImageIndex = this.slides.findIndex(
          (slide) => slide.image === previousImage,
        );
        this.currentIndex = sameImageIndex >= 0 ? sameImageIndex : 0;
      } else {
        this.currentIndex = 0;
      }

      this.renderCurrentSlide();

      if (this.isRunning && !this.isClosed) {
        this.scheduleNextTransition();
      }
    }

    async start() {
      if (!this.slides.length || this.isRunning) {
        return;
      }

      this.isRunning = true;
      if (this.currentIndex < 0) {
        this.currentIndex = 0;
      }

      await this.ensureCurrentSlideLoaded();
      this.renderCurrentSlide();
      this.scheduleNextTransition();
    }

    stop() {
      this.isRunning = false;
      this.clearTimers();
    }

    setClosedState(isClosed) {
      this.isClosed = isClosed;
      if (isClosed) {
        this.clearTimers();
      } else if (this.isRunning) {
        this.scheduleNextTransition();
      }
    }

    clearTimers() {
      if (this.slideTimer) {
        clearTimeout(this.slideTimer);
        this.slideTimer = null;
      }

      if (this.transitionTimer) {
        clearTimeout(this.transitionTimer);
        this.transitionTimer = null;
      }
    }

    clearVisuals() {
      this.currentEl.style.backgroundImage = "none";
      this.nextEl.style.backgroundImage = "none";
      this.nextEl.style.opacity = "0";
      this.currentEl.style.opacity = "1";
      clearBadgeElement(this.currentBadgeEl);
      clearBadgeElement(this.nextBadgeEl);
    }

    async ensureCurrentSlideLoaded() {
      if (!this.slides.length) {
        return false;
      }

      const maxAttempts = this.slides.length;
      let attempts = 0;

      while (attempts < maxAttempts) {
        const slide = this.slides[this.currentIndex];
        const loaded = await preloadImage(slide.image);
        if (loaded) {
          return true;
        }

        this.currentIndex = this.getNextIndex(this.currentIndex);
        attempts += 1;
      }

      return false;
    }

    renderCurrentSlide() {
      if (!this.slides.length || this.currentIndex < 0) {
        return;
      }

      const slide = this.slides[this.currentIndex];
      this.currentEl.style.backgroundImage = buildBackgroundImage(slide.image);
      this.currentEl.style.opacity = "1";
      this.nextEl.style.opacity = "0";
      applyBadgeStatus(this.currentBadgeEl, getSlideStatus(slide, new Date()));
      clearBadgeElement(this.nextBadgeEl);
    }

    scheduleNextTransition() {
      this.clearTimers();

      if (!this.isRunning || this.isClosed || this.slides.length <= 1) {
        return;
      }

      const currentSlide = this.slides[this.currentIndex];
      const durationMs = Math.max(
        3000,
        Math.floor((currentSlide.duration || this.defaultDurationSec) * 1000),
      );

      this.slideTimer = setTimeout(() => {
        this.transitionToNext().catch((error) => {
          console.error("Transition failed:", error);
          this.scheduleNextTransition();
        });
      }, durationMs);
    }

    async transitionToNext() {
      if (!this.isRunning || this.isClosed || this.slides.length <= 1) {
        return;
      }

      const candidateIndexes = this.getCandidateIndexes();
      let targetIndex = -1;

      for (const index of candidateIndexes) {
        const loaded = await preloadImage(this.slides[index].image);
        if (loaded) {
          targetIndex = index;
          break;
        }
      }

      if (targetIndex < 0) {
        this.scheduleNextTransition();
        return;
      }

      this.nextEl.style.backgroundImage = buildBackgroundImage(
        this.slides[targetIndex].image,
      );
      const nextBadgeStatus = getSlideStatus(
        this.slides[targetIndex],
        new Date(),
      );
      applyBadgeStatus(this.nextBadgeEl, nextBadgeStatus);
      this.currentBadgeEl.classList.remove("is-visible");
      this.nextEl.style.opacity = "1";
      this.currentEl.style.opacity = "0";

      this.transitionTimer = setTimeout(() => {
        const oldCurrent = this.currentEl;
        this.currentEl = this.nextEl;
        this.nextEl = oldCurrent;

        const oldCurrentBadge = this.currentBadgeEl;
        this.currentBadgeEl = this.nextBadgeEl;
        this.nextBadgeEl = oldCurrentBadge;

        this.nextEl.style.opacity = "0";
        this.nextEl.style.backgroundImage = "none";
        clearBadgeElement(this.nextBadgeEl);

        this.currentIndex = targetIndex;
        this.scheduleNextTransition();
      }, this.transitionDurationMs + 40);
    }

    getCandidateIndexes() {
      const indexes = [];
      let nextIndex = this.getNextIndex(this.currentIndex);

      for (let i = 0; i < this.slides.length - 1; i += 1) {
        indexes.push(nextIndex);
        nextIndex = this.getNextIndex(nextIndex);
      }

      return indexes;
    }

    getNextIndex(index) {
      return (index + 1) % this.slides.length;
    }
  }

  class ScheduleController {
    constructor(config, slideshow) {
      this.config = config;
      this.slideshow = slideshow;
      this.checkTimer = null;
      this.lastState = null;
    }

    start() {
      this.evaluate();
      this.checkTimer = setInterval(
        () => this.evaluate(),
        this.config.scheduleCheckMs,
      );
    }

    stop() {
      if (this.checkTimer) {
        clearInterval(this.checkTimer);
        this.checkTimer = null;
      }
    }

    evaluate() {
      const now = new Date();
      const isOpen = isWithinDisplayWindow(
        now,
        this.config.displayStart,
        this.config.displayEnd,
      );
      if (this.lastState === isOpen) {
        return;
      }

      this.lastState = isOpen;
      if (isOpen) {
        dom.app.classList.remove("is-closed");
        dom.closedScreen.classList.remove("active");
        dom.closedScreen.setAttribute("aria-hidden", "true");
        this.slideshow.setClosedState(false);
      } else {
        const reopenAt = formatReopenLabel(this.config.displayStart);
        dom.reopenTime.textContent = `Reopens at ${reopenAt}`;
        dom.app.classList.add("is-closed");
        dom.closedScreen.classList.add("active");
        dom.closedScreen.setAttribute("aria-hidden", "false");
        this.slideshow.setClosedState(true);
      }
    }
  }

  class SignageApp {
    constructor() {
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      this.configService = new ConfigService("/display/config.json");
      this.calendarService = null;
      this.playlistService = null;
      this.playlistRefreshTimer = null;
      this.clockTimer = null;

      this.slideshow = new SlideshowEngine({
        currentEl: dom.slideCurrent,
        nextEl: dom.slideNext,
        currentBadgeEl: dom.posterBadgeCurrent,
        nextBadgeEl: dom.posterBadgeNext,
        transitionDurationMs: DEFAULT_CONFIG.transitionDurationMs,
        defaultDurationSec: 12,
      });

      this.scheduleController = null;
      this.isRefreshing = false;
    }

    async init() {
      this.config = await this.configService.load();
      this.applyConfigToUi(this.config);
      this.startClock();
      this.calendarService = new CalendarService(
        this.config.calendarPath,
        this.config.calendarYear,
      );
      await this.refreshCalendar();

      this.playlistService = new PlaylistService(this.config.playlistPath);
      const initialPlaylist = await this.playlistService.loadInitial();
      this.playlistService.lastSignature = initialPlaylist.signature;
      this.slideshow.setSlides(initialPlaylist.slides);
      await this.slideshow.start();

      this.scheduleController = new ScheduleController(
        this.config,
        this.slideshow,
      );
      this.scheduleController.start();

      this.startPlaylistRefresh();
      this.attachLifecycleEvents();
      this.registerServiceWorker();
    }

    applyConfigToUi(config) {
      if (Number.isFinite(config.rotationDeg)) {
        dom.rotatedStage.style.transform = `rotate(${config.rotationDeg}deg) translateY(-100%)`;
      }

      const timingsItems = normalizeTileItems(
        config.placeholders.info,
        DEFAULT_CONFIG.placeholders.info,
      );
      renderTiles(dom.info, timingsItems);

      const eventItems = normalizeTileItems(
        config.placeholders.calendar,
        DEFAULT_CONFIG.placeholders.calendar,
      );
      renderTiles(dom.calendar, eventItems);
      this.updateCalendarHeading();

      renderQr(dom.qrPlaceholder, config);
      setFormattedAsteriskText(
        dom.announcement,
        config.placeholders.announcement,
      );

      document.documentElement.style.setProperty(
        "--color-primary",
        config.theme.primary,
      );
      document.documentElement.style.setProperty(
        "--color-accent",
        config.theme.accent,
      );
      document.documentElement.style.setProperty(
        "--color-bg",
        config.theme.background,
      );

      this.slideshow.setTransitionDuration(config.transitionDurationMs);
    }

    updateCalendarHeading() {
      if (!dom.calendarHeading) {
        return;
      }

      const now = new Date();
      const monthName = MONTH_NAMES[now.getMonth()] || "Current";
      dom.calendarHeading.textContent = `Upcoming In ${monthName}`;
    }

    async refreshCalendar() {
      if (!this.calendarService) {
        return;
      }

      const items = await this.calendarService.loadUpcoming(
        this.config.calendarMaxItems,
      );
      if (!items.length) {
        this.updateCalendarHeading();
        return;
      }

      renderTiles(dom.calendar, items);
      this.updateCalendarHeading();
    }

    startPlaylistRefresh() {
      if (this.playlistRefreshTimer) {
        clearInterval(this.playlistRefreshTimer);
      }

      this.playlistRefreshTimer = setInterval(() => {
        this.refreshPlaylist().catch((error) => {
          console.warn("Playlist refresh failed:", error);
        });
      }, this.config.playlistRefreshMs);
    }

    async refreshPlaylist() {
      if (this.isRefreshing) {
        return;
      }

      this.isRefreshing = true;
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
        this.isRefreshing = false;
      }
    }

    attachLifecycleEvents() {
      window.addEventListener("online", () => {
        this.refreshPlaylist().catch((error) => {
          console.warn("Online refresh failed:", error);
        });

        this.refreshCalendar().catch((error) => {
          console.warn("Online calendar refresh failed:", error);
        });
      });

      window.addEventListener("beforeunload", () => {
        if (this.playlistRefreshTimer) {
          clearInterval(this.playlistRefreshTimer);
          this.playlistRefreshTimer = null;
        }

        if (this.scheduleController) {
          this.scheduleController.stop();
        }

        if (this.clockTimer) {
          clearInterval(this.clockTimer);
          this.clockTimer = null;
        }

        this.slideshow.stop();
      });
    }

    startClock() {
      if (!dom.welcomeClock) {
        return;
      }

      if (this.clockTimer) {
        clearInterval(this.clockTimer);
      }

      const updateClock = () => {
        dom.welcomeClock.textContent = formatWelcomeTime(new Date());
      };

      updateClock();
      this.clockTimer = setInterval(updateClock, 30 * 1000);
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
      } catch (error) {
        console.warn("Service worker registration failed:", error);
      }
    }
  }

  function mergeConfig(baseConfig, incoming) {
    return {
      ...baseConfig,
      ...incoming,
      placeholders: {
        ...baseConfig.placeholders,
        ...(incoming.placeholders || {}),
      },
      theme: {
        ...baseConfig.theme,
        ...(incoming.theme || {}),
      },
      qr: {
        ...baseConfig.qr,
        ...(incoming.qr || {}),
      },
    };
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
          startDate:
            slide && typeof slide.startDate === "string"
              ? slide.startDate.trim()
              : "",
          endDate:
            slide && typeof slide.endDate === "string"
              ? slide.endDate.trim()
              : "",
          recurrence: normalizeRecurrence(slide && slide.recurrence),
        };
      })
      .filter((slide) => slide && slide.type === "image");
  }

  function normalizeRecurrence(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const type =
      typeof value.type === "string" ? value.type.trim().toLowerCase() : "";
    if (type !== "weekly") {
      return null;
    }

    const rawDays = Array.isArray(value.days) ? value.days : [];
    const days = [
      ...new Set(
        rawDays
          .map((day) => Number(day))
          .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
      ),
    ].sort((a, b) => a - b);

    if (!days.length) {
      return null;
    }

    const label = typeof value.label === "string" ? value.label.trim() : "";

    return {
      type,
      days,
      label,
    };
  }

  function getSignature(slides) {
    return JSON.stringify(
      slides.map((slide) => ({
        image: slide.image,
        duration: slide.duration,
        type: slide.type,
        startDate: slide.startDate,
        endDate: slide.endDate,
        recurrence: slide.recurrence,
      })),
    );
  }

  function buildBackgroundImage(url) {
    const sanitized = String(url).replace(/"/g, '\\"');
    return `url("${sanitized}")`;
  }

  function applyBadgeStatus(element, status) {
    if (!element) {
      return;
    }

    element.classList.remove(
      "badge-upcoming",
      "badge-today",
      "badge-past",
      "badge-recurring",
      "badge-recurring-today",
      "is-visible",
    );

    if (!status) {
      element.textContent = "";
      return;
    }

    element.textContent = status.label;
    element.classList.add(status.cssClass, "is-visible");
  }

  function clearBadgeElement(element) {
    if (!element) {
      return;
    }

    element.classList.remove(
      "badge-upcoming",
      "badge-today",
      "badge-past",
      "badge-recurring",
      "badge-recurring-today",
      "is-visible",
    );
    element.textContent = "";
  }

  function getSlideStatus(slide, now) {
    const start = parseDateOnly(slide && slide.startDate);
    const end = parseDateOnly(slide && slide.endDate);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    if (start && end) {
      const startTs = start.getTime();
      const endTs = end.getTime();

      if (todayTs < startTs) {
        const daysRemaining = getDayDiff(todayTs, startTs);
        return {
          label: formatDaysRemainingLabel(daysRemaining),
          cssClass: "badge-upcoming",
        };
      }

      if (todayTs > endTs) {
        return { label: "Past Event", cssClass: "badge-past" };
      }

      return {
        label: "Ongoing Event",
        cssClass: "badge-today",
      };
    }

    if (!start && end) {
      const endTs = end.getTime();

      if (todayTs > endTs) {
        return { label: "Past Event", cssClass: "badge-past" };
      }

      if (todayTs === endTs) {
        return {
          label: "Happening Today",
          cssClass: "badge-today",
        };
      }

      const daysRemaining = getDayDiff(todayTs, endTs);
      return {
        label: formatDaysRemainingLabel(daysRemaining),
        cssClass: "badge-upcoming",
      };
    }

    const recurrence = normalizeRecurrence(slide && slide.recurrence);
    if (recurrence && recurrence.type === "weekly") {
      const todayDay = now.getDay();
      const isToday = recurrence.days.includes(todayDay);
      if (isToday) {
        return {
          label: `Today • ${DAY_NAMES_FULL[todayDay]}`,
          cssClass: "badge-recurring-today",
        };
      }

      return {
        label: recurrence.label || buildWeeklyLabel(recurrence.days),
        cssClass: "badge-recurring",
      };
    }

    if (!start || !end) {
      return null;
    }

    return null;
  }

  function buildWeeklyLabel(days) {
    if (!Array.isArray(days) || !days.length) {
      return "Weekly";
    }

    if (days.length === 1) {
      const dayName = DAY_NAMES_FULL[days[0]] || "Weekly";
      return `Every ${dayName}`;
    }

    const dayList = days
      .map((day) => DAY_NAMES_SHORT[day])
      .filter(Boolean)
      .join(", ");

    return dayList ? `Weekly • ${dayList}` : "Weekly";
  }

  function parseDateOnly(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day)
    ) {
      return null;
    }

    const date = new Date(year, month, day);
    date.setHours(0, 0, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  async function preloadImage(url) {
    return new Promise((resolve) => {
      const image = new Image();
      let done = false;

      const cleanup = () => {
        image.onload = null;
        image.onerror = null;
      };

      const finish = (result) => {
        if (done) {
          return;
        }

        done = true;
        cleanup();
        resolve(result);
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

  function isWithinDisplayWindow(now, startTime, endTime) {
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

  function formatReopenLabel(time24h) {
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

  function normalizeTileItems(value, fallback) {
    const source = value == null ? fallback : value;

    if (Array.isArray(source)) {
      const cleaned = source
        .map((item) => {
          const text = typeof item === "string" ? item : String(item || "");
          return text.trim();
        })
        .filter(Boolean);
      return cleaned.length ? cleaned : [fallback];
    }

    const text = typeof source === "string" ? source : String(source || "");
    const parts = text
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);

    return parts.length ? parts : [fallback];
  }

  function getUpcomingCalendarItems(eventsByMonth, year, maxItems) {
    const cappedMax = Math.max(1, Number(maxItems) || 7);
    const now = new Date();
    const todayDate = now.getDate();
    const currentYear = now.getFullYear();
    const targetYear = Number(year);
    const shouldFilterPastDates = Number.isFinite(targetYear)
      ? currentYear === targetYear
      : true;
    const currentMonth = now.getMonth();
    const monthName = MONTH_NAMES[currentMonth];
    const monthEvents = Array.isArray(eventsByMonth[monthName])
      ? eventsByMonth[monthName]
      : [];

    const sortedEvents = monthEvents
      .filter((entry) => {
        const day = Number(entry && entry.date);
        if (!Number.isFinite(day) || day < 1 || day > 31) {
          return false;
        }

        if (!shouldFilterPastDates) {
          return true;
        }

        return day >= todayDate;
      })
      .sort((a, b) => Number(a.date) - Number(b.date));

    const hasOverflow = sortedEvents.length > cappedMax;
    const visibleCount = hasOverflow ? Math.max(0, cappedMax - 1) : cappedMax;
    const visibleEvents = sortedEvents.slice(0, visibleCount);

    const items = visibleEvents.map((entry) => {
      const day = Number(entry.date);
      const label = formatCalendarLine(day, entry.event);
      return {
        text: label,
        important: Boolean(entry.important),
      };
    });

    if (hasOverflow) {
      const hiddenCount = sortedEvents.length - visibleCount;
      items.push({
        text: `... +${hiddenCount} more`,
        important: false,
      });
    }

    if (!items.length) {
      return [`No Upcoming Events For ${monthName} ${year}.`];
    }

    return items;
  }

  function renderTiles(container, items) {
    if (!container) {
      return;
    }

    container.innerHTML = "";
    items.forEach((item) => {
      const tile = document.createElement("p");
      tile.className = "info-tile";
      if (item && typeof item === "object") {
        setFormattedAsteriskText(
          tile,
          typeof item.text === "string" ? item.text : "",
        );
        if (item.important) {
          tile.classList.add("info-tile-important");
        }
      } else {
        setFormattedAsteriskText(tile, String(item || ""));
      }
      container.appendChild(tile);
    });
  }

  function renderQr(container, config) {
    if (!container) {
      return;
    }

    const targetUrl = buildConnectUrl(config);
    const qrSrc = buildQrImageUrl(targetUrl, config);
    const qrLabel =
      config &&
      config.placeholders &&
      typeof config.placeholders.qrLabel === "string"
        ? config.placeholders.qrLabel
        : "QR";
    const qrCaption =
      config &&
      config.placeholders &&
      typeof config.placeholders.qrCaption === "string" &&
      config.placeholders.qrCaption.trim()
        ? config.placeholders.qrCaption.trim()
        : "Scan me";
    const qrPlatformsLabel =
      config &&
      config.placeholders &&
      typeof config.placeholders.qrPlatformsLabel === "string" &&
      config.placeholders.qrPlatformsLabel.trim()
        ? config.placeholders.qrPlatformsLabel.trim()
        : "WhatsApp • Instagram • Facebook";

    container.innerHTML = "";

    const link = document.createElement("a");
    link.className = "qr-link";
    link.href = targetUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Open connect with us page");

    const image = document.createElement("img");
    image.className = "qr-image";
    image.src = qrSrc;
    image.alt = `${qrLabel} - Connect with us`;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.onerror = () => {
      setFormattedAsteriskText(container, qrLabel);
      container.style.display = "grid";
      container.style.placeItems = "center";
    };

    const caption = document.createElement("p");
    caption.className = "qr-caption";
    setFormattedAsteriskText(caption, qrCaption);

    const platforms = document.createElement("p");
    platforms.className = "qr-platforms";
    setFormattedAsteriskText(platforms, qrPlatformsLabel);

    link.appendChild(image);
    container.appendChild(link);
    container.appendChild(caption);
    container.appendChild(platforms);
  }

  function buildConnectUrl(config) {
    const qrConfig = (config && config.qr) || {};
    const connectPath =
      typeof qrConfig.connectPath === "string" && qrConfig.connectPath.trim()
        ? qrConfig.connectPath.trim()
        : "/connect-with-us.html";

    const baseOrigin = window.location.origin;
    const url = new URL(connectPath, baseOrigin);

    const channelParamName =
      typeof qrConfig.channelParamName === "string" &&
      qrConfig.channelParamName.trim()
        ? qrConfig.channelParamName.trim()
        : "channel";
    const channelParamValue =
      typeof qrConfig.channelParamValue === "string" &&
      qrConfig.channelParamValue.trim()
        ? qrConfig.channelParamValue.trim()
        : "whatsapp";

    const whatsappParamName =
      typeof qrConfig.whatsappParamName === "string" &&
      qrConfig.whatsappParamName.trim()
        ? qrConfig.whatsappParamName.trim()
        : "wa";
    const whatsappJoinUrl =
      typeof qrConfig.whatsappJoinUrl === "string" &&
      qrConfig.whatsappJoinUrl.trim()
        ? qrConfig.whatsappJoinUrl.trim()
        : "";

    url.searchParams.set(channelParamName, channelParamValue);
    url.searchParams.set(whatsappParamName, whatsappJoinUrl);

    return url.toString();
  }

  function buildQrImageUrl(targetUrl, config) {
    const size =
      config &&
      config.qr &&
      Number.isFinite(Number(config.qr.qrPixelSize)) &&
      Number(config.qr.qrPixelSize) > 0
        ? Math.floor(Number(config.qr.qrPixelSize))
        : 360;
    const encodedTarget = encodeURIComponent(targetUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodedTarget}`;
  }

  function formatCalendarLine(day, eventName) {
    const dayText = String(day).padStart(2, "0");
    const eventText = typeof eventName === "string" ? eventName.trim() : "";
    return `${dayText}......${eventText}`;
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

  function getDayDiff(fromTs, toTs) {
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.round((toTs - fromTs) / oneDayMs));
  }

  function formatDaysRemainingLabel(days) {
    const safeDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0;
    const suffix = safeDays === 1 ? "Day" : "Days";
    return `${safeDays} ${suffix} Remaining`;
  }

  function setFormattedAsteriskText(element, value) {
    if (!element) {
      return;
    }

    const text = typeof value === "string" ? value : String(value || "");
    element.textContent = "";

    const pattern = /\*([^*]+)\*/g;
    let cursor = 0;
    let match = pattern.exec(text);

    while (match) {
      if (match.index > cursor) {
        element.appendChild(
          document.createTextNode(text.slice(cursor, match.index)),
        );
      }

      const strong = document.createElement("strong");
      strong.textContent = match[1];
      element.appendChild(strong);

      cursor = pattern.lastIndex;
      match = pattern.exec(text);
    }

    if (cursor < text.length) {
      element.appendChild(document.createTextNode(text.slice(cursor)));
    }
  }

  const app = new SignageApp();
  app.init().catch((error) => {
    console.error("Signage app initialization failed:", error);
  });
})();
