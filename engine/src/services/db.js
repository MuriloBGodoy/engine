import { get, set, del } from "idb-keyval";

const defaultSettings = {
  profile: {
    displayName: "",
    username: "",
    phone: "",
    location: "",
    bio: "",
    avatar: "",
  },
  preferences: {
    language: "pt-BR",
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    theme: "dark",
    density: "comfortable",
    startPage: "/",
    defaultGarageSort: "progress-desc",
    annualIncomeGoal: "",
  },
  notifications: {
    emailGoalProgress: true,
    emailMarketUpdates: true,
    emailSecurity: true,
    inAppReminders: true,
    weeklyDigest: false,
    quietHours: true,
  },
  privacy: {
    showEmailInSidebar: true,
    shareAnonymousUsage: false,
    saveImagesLocally: true,
    lockSensitiveValues: false,
  },
  security: {
    twoFactorReminder: true,
    sessionTimeout: "30",
    loginAlerts: true,
  },
};

const USERNAME_REGISTRY_KEY = "engine_username_registry";
const LEGACY_CARS_KEY = "engine_cars";
const LEGACY_SETTINGS_KEY = "engine_settings";
const defaultCommunityState = {
  interactions: {},
  following: [],
  sharedGoalIds: [],
  savedVideos: [],
};
let currentUserId = null;

const scopedKey = (name, userId = currentUserId) => {
  if (!userId) {
    throw new Error("Usuario nao identificado.");
  }
  return `engine_users:${userId}:${name}`;
};

const mergeSettings = (settings = {}) => ({
  profile: { ...defaultSettings.profile, ...(settings.profile || {}) },
  preferences: {
    ...defaultSettings.preferences,
    ...(settings.preferences || {}),
  },
  notifications: {
    ...defaultSettings.notifications,
    ...(settings.notifications || {}),
  },
  privacy: { ...defaultSettings.privacy, ...(settings.privacy || {}) },
  security: { ...defaultSettings.security, ...(settings.security || {}) },
});

const normalizeUsername = (username = "") => {
  const clean = username
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 24);

  return clean ? `@${clean}` : "";
};

const normalizePhone = (phone = "") =>
  phone
    .trim()
    .replace(/[^\d+()\-\s]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 24);

const normalizeSettings = (settings = {}) => {
  const merged = mergeSettings(settings);
  return {
    ...merged,
    profile: {
      ...merged.profile,
      displayName: merged.profile.displayName.trim().slice(0, 80),
      username: normalizeUsername(merged.profile.username),
      phone: normalizePhone(merged.profile.phone),
      location: merged.profile.location.trim().slice(0, 80),
      bio: merged.profile.bio.trim().slice(0, 280),
    },
  };
};

const normalizeCar = (car) => ({
  id: car.id || crypto.randomUUID(),
  brand: String(car.brand || "").trim().slice(0, 80),
  model: String(car.model || "").trim().slice(0, 120),
  year: String(car.year || "").trim().slice(0, 40),
  targetValue: Math.max(Number(car.targetValue) || 0, 0),
  savedValue: Math.max(Number(car.savedValue) || 0, 0),
  image: String(car.image || "").trim(),
  updatedAt: new Date().toISOString(),
});

const normalizeCommunityState = (state = {}) => ({
  interactions: state.interactions || {},
  following: Array.isArray(state.following) ? state.following : [],
  sharedGoalIds: Array.isArray(state.sharedGoalIds) ? state.sharedGoalIds : [],
  savedVideos: Array.isArray(state.savedVideos) ? state.savedVideos : [],
});

export const engineDB = {
  setCurrentUser(userId) {
    currentUserId = userId || null;
  },

  async migrateLegacyData(userId) {
    if (!userId) return;

    const migratedKey = scopedKey("legacy_migrated", userId);
    if (await get(migratedKey)) return;

    const [existingCars, legacyCars, existingSettings, legacySettings] =
      await Promise.all([
        get(scopedKey("cars", userId)),
        get(LEGACY_CARS_KEY),
        get(scopedKey("settings", userId)),
        get(LEGACY_SETTINGS_KEY),
      ]);

    if (!existingCars && legacyCars?.length) {
      await set(scopedKey("cars", userId), legacyCars.map(normalizeCar));
    }

    if (!existingSettings && legacySettings) {
      await set(scopedKey("settings", userId), normalizeSettings(legacySettings));
    }

    await set(migratedKey, true);
  },

  async getCars() {
    return (await get(scopedKey("cars"))) || [];
  },

  async saveCar(car) {
    const cars = await this.getCars();
    const normalizedCar = normalizeCar(car);
    const index = cars.findIndex((c) => c.id === car.id);
    if (index !== -1) {
      cars[index] = normalizedCar;
    } else {
      cars.push(normalizedCar);
    }
    await set(scopedKey("cars"), cars);
  },

  async deleteCar(id) {
    const cars = await this.getCars();
    const updatedCars = cars.filter((c) => c.id !== id);
    await set(scopedKey("cars"), updatedCars);
  },

  async resetDatabase() {
    await del(scopedKey("cars"));
  },

  async getCommunityState() {
    const state = await get(scopedKey("community"));
    return normalizeCommunityState(state);
  },

  async saveCommunityState(state) {
    const normalizedState = normalizeCommunityState(state);
    await set(scopedKey("community"), normalizedState);
    return normalizedState;
  },

  async getSettings() {
    const settings = await get(scopedKey("settings"));
    return normalizeSettings(settings);
  },

  async saveSettings(settings, userId = currentUserId) {
    const mergedSettings = normalizeSettings(settings);
    await this.reserveUsername(mergedSettings.profile.username, userId);
    await set(scopedKey("settings", userId), mergedSettings);
    return mergedSettings;
  },

  async resetSettings() {
    await del(scopedKey("settings"));
    return defaultSettings;
  },

  async reserveUsername(username, userId = currentUserId) {
    const normalized = normalizeUsername(username);
    if (!normalized) return "";

    const registry = (await get(USERNAME_REGISTRY_KEY)) || {};
    const owner = registry[normalized];

    if (owner && owner !== userId && owner !== "pending") {
      throw new Error("Este usuario ja esta em uso.");
    }

    await set(USERNAME_REGISTRY_KEY, {
      ...registry,
      [normalized]: userId,
    });

    return normalized;
  },

  async releasePendingUsername(username) {
    const normalized = normalizeUsername(username);
    if (!normalized) return;

    const registry = (await get(USERNAME_REGISTRY_KEY)) || {};
    if (registry[normalized] === "pending") {
      delete registry[normalized];
      await set(USERNAME_REGISTRY_KEY, registry);
    }
  },

  normalizeUsername,
  normalizePhone,

  getDefaultSettings() {
    return defaultSettings;
  },

  getDefaultCommunityState() {
    return defaultCommunityState;
  },
};
