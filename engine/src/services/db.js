import { get, set, del } from "idb-keyval";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, firestore } from "./firebase";

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
const USERS_COLLECTION = "users";
const USERNAMES_COLLECTION = "usernames";
const COMMUNITY_COLLECTION = "communityGoals";
const PUBLIC_PROFILES_COLLECTION = "publicProfiles";
const FIRESTORE_TIMEOUT_MS = 7000;
const ENGINE_API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";
const defaultCommunityState = {
  interactions: {},
  following: [],
  sharedGoalIds: [],
  savedVideos: [],
};
let currentUserId = null;

const apiEnabled = () => Boolean(ENGINE_API_URL && auth.currentUser);

const apiRequest = async (path, options = {}) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Usuario nao autenticado.");
  }

  const response = await fetch(`${ENGINE_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "Falha ao chamar Engine API.");
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const apiJson = (method, path, body) =>
  apiRequest(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

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
  id: String(car.id || crypto.randomUUID()),
  brand: String(car.brand || "").trim().slice(0, 80),
  model: String(car.model || "").trim().slice(0, 120),
  year: String(car.year || "").trim().slice(0, 40),
  targetValue: Math.max(Number(car.targetValue) || 0, 0),
  savedValue: Math.max(Number(car.savedValue) || 0, 0),
  image: String(car.image || "").trim(),
  updatedAt: car.updatedAt || new Date().toISOString(),
});

const serializeForFirestore = (value) => JSON.parse(JSON.stringify(value));

const withTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(
        () => reject(new Error(`${label} demorou demais para responder.`)),
        FIRESTORE_TIMEOUT_MS,
      );
    }),
  ]);

const localUserKey = (name, userId = currentUserId) =>
  userId ? scopedKey(name, userId) : name;

const getLocalCars = async (userId = currentUserId) =>
  (await get(localUserKey("cars", userId))) || (await get(LEGACY_CARS_KEY)) || [];

const setLocalCars = async (cars, userId = currentUserId) => {
  if (userId) {
    await set(scopedKey("cars", userId), cars);
    return;
  }

  await set(LEGACY_CARS_KEY, cars);
};

const getLocalSettings = async (userId = currentUserId) =>
  (await get(localUserKey("settings", userId))) ||
  (await get(LEGACY_SETTINGS_KEY));

const setLocalSettings = async (settings, userId = currentUserId) => {
  if (userId) {
    await set(scopedKey("settings", userId), settings);
    return;
  }

  await set(LEGACY_SETTINGS_KEY, settings);
};

const warnFirestoreFallback = (operation, error) => {
  console.warn(`Firestore indisponivel em ${operation}. Usando fallback local.`, error);
};

const userDoc = (userId = currentUserId) => {
  if (!userId) {
    throw new Error("Usuario nao identificado.");
  }
  return doc(firestore, USERS_COLLECTION, userId);
};

const userCarsCollection = (userId = currentUserId) =>
  collection(userDoc(userId), "cars");

const userCarDoc = (carId, userId = currentUserId) =>
  doc(userCarsCollection(userId), String(carId));

const userSettingsDoc = (userId = currentUserId) =>
  doc(userDoc(userId), "private", "settings");

const userCommunityDoc = (userId = currentUserId) =>
  doc(userDoc(userId), "private", "community");

const userNotificationsCollection = (userId = currentUserId) =>
  collection(userDoc(userId), "notifications");

const publicProfileDoc = (userId) =>
  doc(firestore, PUBLIC_PROFILES_COLLECTION, String(userId));

const usernameDocId = (username) => normalizeUsername(username).replace(/^@/, "");

const getProfileSnapshot = (settings = {}, userId = currentUserId) => {
  const profile = settings.profile || {};
  const author = profile.displayName || "Usuario Engine";
  const username = normalizeUsername(profile.username) || `@engine.${userId.slice(0, 6)}`;

  return {
    author,
    username,
    avatar: profile.avatar || "",
    avatarInitials: author
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
    city: profile.location || "Engine Garage",
    note: profile.bio || "",
  };
};

const buildPublicProfile = (settings = {}, userId = currentUserId) => {
  const profile = getProfileSnapshot(settings, userId);
  return {
    id: userId,
    userId,
    ...profile,
    updatedAt: serverTimestamp(),
  };
};

const buildCommunityGoal = (goal, userId, settings = {}) => {
  const profile = getProfileSnapshot(settings, userId);

  return {
    id: `goal-${userId}-${goal.id}`,
    ownerId: userId,
    carId: String(goal.id),
    author: profile.author,
    username: profile.username,
    avatar: profile.avatar,
    avatarInitials: profile.avatarInitials,
    city: profile.city,
    title: `${goal.brand} ${goal.model}`,
    brand: goal.brand,
    model: goal.model,
    year: goal.year,
    image: goal.image,
    savedValue: goal.savedValue,
    targetValue: goal.targetValue,
    note: profile.note,
    verified: true,
    likesBy: {},
    comments: [],
    ratingsBy: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

const normalizeCommunityGoal = (goal = {}) => {
  const ratings = Object.values(goal.ratingsBy || {}).map(Number).filter(Boolean);
  const rating = ratings.length
    ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
    : 0;
  const author = goal.author || "Usuario Engine";

  return {
    id: goal.id,
    author,
    username: goal.username || "@engine",
    avatar:
      goal.avatar ||
      goal.avatarInitials ||
      author
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
    city: goal.city || "Engine Garage",
    title: goal.title || `${goal.brand || ""} ${goal.model || ""}`.trim(),
    brand: goal.brand || "",
    model: goal.model || "",
    year: goal.year || "",
    image: goal.image || "",
    savedValue: Number(goal.savedValue) || 0,
    targetValue: Number(goal.targetValue) || 0,
    streak: Number(goal.streak) || 1,
    likes: Object.keys(goal.likesBy || {}).length,
    comments: (goal.comments || []).map((comment) =>
      typeof comment === "string"
        ? { text: comment, author: "Engine", username: "@engine" }
        : {
            text: comment.text,
            author: comment.author || "Usuario Engine",
            username: comment.username || "@engine",
            avatar: comment.avatar || comment.avatarInitials || "",
            avatarInitials: comment.avatarInitials || "",
            userId: comment.userId || "",
            createdAt: comment.createdAt || "",
          },
    ),
    rating: rating || 0,
    verified: Boolean(goal.verified),
    tagKey: "community.seed.mine",
    noteKey: goal.note ? null : "community.seed.mineNote",
    note: goal.note || "",
    isMine: goal.ownerId === currentUserId,
    ownerId: goal.ownerId,
    carId: goal.carId,
    likesBy: goal.likesBy || {},
    ratingsBy: goal.ratingsBy || {},
  };
};

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

    let firestoreCars;
    let firestoreSettings;

    try {
      [firestoreCars, firestoreSettings] = await Promise.all([
        withTimeout(getDocs(userCarsCollection(userId)), "migracao de carros"),
        withTimeout(getDoc(userSettingsDoc(userId)), "migracao de configuracoes"),
      ]);
    } catch (error) {
      warnFirestoreFallback("migrateLegacyData", error);
      await set(migratedKey, true);
      return;
    }

    if (firestoreCars.empty) {
      const carsToMigrate = existingCars?.length ? existingCars : legacyCars;
      if (carsToMigrate?.length) {
        const batch = writeBatch(firestore);
        carsToMigrate.map(normalizeCar).forEach((car) => {
          batch.set(userCarDoc(car.id, userId), serializeForFirestore(car));
        });
        await batch.commit();
      }
    }

    if (!firestoreSettings.exists()) {
      const settingsToMigrate = existingSettings || legacySettings;
      if (settingsToMigrate) {
        await setDoc(
          userSettingsDoc(userId),
          serializeForFirestore(normalizeSettings(settingsToMigrate)),
        );
      }
    }

    await set(migratedKey, true);
  },

  async getCars() {
    if (!currentUserId) return getLocalCars();

    if (apiEnabled()) {
      const cars = await apiRequest("/cars");
      await setLocalCars(cars);
      return cars;
    }

    try {
      const snapshot = await withTimeout(getDocs(userCarsCollection()), "buscar carros");
      return snapshot.docs
        .map((item) => normalizeCar({ id: item.id, ...item.data() }))
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    } catch (error) {
      warnFirestoreFallback("getCars", error);
      return getLocalCars();
    }
  },

  async saveCar(car) {
    const normalizedCar = normalizeCar(car);

    if (!currentUserId) {
      const cars = await getLocalCars();
      const index = cars.findIndex((c) => c.id === car.id);
      if (index !== -1) {
        cars[index] = normalizedCar;
      } else {
        cars.push(normalizedCar);
      }
      await setLocalCars(cars);
      return normalizedCar;
    }

    if (apiEnabled()) {
      const savedCar = await apiJson("POST", "/cars", normalizedCar);
      const localCars = await getLocalCars();
      const index = localCars.findIndex((c) => c.id === savedCar.id);
      if (index !== -1) {
        localCars[index] = savedCar;
      } else {
        localCars.push(savedCar);
      }
      await setLocalCars(localCars);
      return savedCar;
    }

    try {
      await withTimeout(
        setDoc(
          userCarDoc(normalizedCar.id),
          serializeForFirestore(normalizedCar),
          { merge: true },
        ),
        "salvar carro",
      );
    } catch (error) {
      warnFirestoreFallback("saveCar", error);
    }

    const localCars = await getLocalCars();
    const index = localCars.findIndex((c) => c.id === normalizedCar.id);
    if (index !== -1) {
      localCars[index] = normalizedCar;
    } else {
      localCars.push(normalizedCar);
    }
    await setLocalCars(localCars);

    return normalizedCar;
  },

  async deleteCar(id) {
    if (!currentUserId) {
      const cars = await this.getCars();
      const updatedCars = cars.filter((c) => c.id !== id);
      await set(LEGACY_CARS_KEY, updatedCars);
      return;
    }

    if (apiEnabled()) {
      await apiRequest(`/cars/${id}`, { method: "DELETE" });
      const cars = await getLocalCars();
      await setLocalCars(cars.filter((c) => c.id !== String(id)));
      return;
    }

    try {
      await Promise.all([
        withTimeout(deleteDoc(userCarDoc(id)), "excluir carro"),
        withTimeout(
          deleteDoc(doc(firestore, COMMUNITY_COLLECTION, `goal-${currentUserId}-${id}`)),
          "excluir post da comunidade",
        ),
      ]);
    } catch (error) {
      warnFirestoreFallback("deleteCar", error);
    }

    const cars = await getLocalCars();
    await setLocalCars(cars.filter((c) => c.id !== String(id)));
  },

  async resetDatabase() {
    if (!currentUserId) {
      await del(LEGACY_CARS_KEY);
      return;
    }

    if (apiEnabled()) {
      await apiRequest("/cars", { method: "DELETE" });
      await setLocalCars([]);
      return;
    }

    const [carsSnapshot, communitySnapshot] = await Promise.all([
      getDocs(userCarsCollection()),
      getDocs(query(collection(firestore, COMMUNITY_COLLECTION))),
    ]);
    const batch = writeBatch(firestore);
    carsSnapshot.docs.forEach((item) => batch.delete(item.ref));
    communitySnapshot.docs
      .filter((item) => item.data().ownerId === currentUserId)
      .forEach((item) => batch.delete(item.ref));
    await batch.commit();
  },

  async getCommunityState() {
    if (!currentUserId) {
      const state = await get("engine_community");
      return normalizeCommunityState(state);
    }

    if (apiEnabled()) {
      return normalizeCommunityState(await apiRequest("/community/state"));
    }

    const snapshot = await getDoc(userCommunityDoc());
    const state = snapshot.exists() ? snapshot.data() : {};
    return normalizeCommunityState(state);
  },

  async saveCommunityState(state) {
    const normalizedState = normalizeCommunityState(state);
    if (!currentUserId) {
      await set("engine_community", normalizedState);
      return normalizedState;
    }

    if (apiEnabled()) {
      return normalizeCommunityState(
        await apiJson("PUT", "/community/state", normalizedState),
      );
    }

    await setDoc(userCommunityDoc(), serializeForFirestore(normalizedState), {
      merge: true,
    });
    return normalizedState;
  },

  subscribeCommunityGoals(callback) {
    if (apiEnabled()) {
      let active = true;
      const load = async () => {
        try {
          const goals = await apiRequest("/community/goals");
          if (active) callback(goals);
        } catch (error) {
          warnFirestoreFallback("subscribeCommunityGoals", error);
          if (active) callback([]);
        }
      };
      load();
      const interval = window.setInterval(load, 10000);
      return () => {
        active = false;
        window.clearInterval(interval);
      };
    }

    const communityQuery = query(
      collection(firestore, COMMUNITY_COLLECTION),
      orderBy("updatedAt", "desc"),
    );

    return onSnapshot(
      communityQuery,
      (snapshot) => {
        callback(
          snapshot.docs.map((item) =>
            normalizeCommunityGoal({ id: item.id, ...item.data() }),
          ),
        );
      },
      (error) => {
        warnFirestoreFallback("subscribeCommunityGoals", error);
        callback([]);
      },
    );
  },

  async shareCommunityGoal(goal, settings, userId = currentUserId) {
    if (!userId) throw new Error("Usuario nao identificado.");

    if (apiEnabled()) {
      const response = await apiJson("POST", "/community/goals", goal);
      return response.id;
    }

    const payload = buildCommunityGoal(goal, userId, settings);
    const goalRef = doc(firestore, COMMUNITY_COLLECTION, payload.id);
    const existing = await getDoc(goalRef);
    const existingData = existing.exists() ? existing.data() : {};

    await setDoc(
      goalRef,
      {
        ...payload,
        likesBy: existingData.likesBy || {},
        comments: existingData.comments || [],
        ratingsBy: existingData.ratingsBy || {},
        createdAt: existingData.createdAt || payload.createdAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return payload.id;
  },

  async syncCommunityProfile(settings, userId = currentUserId) {
    if (!userId) return;
    if (apiEnabled()) return;

    const profile = getProfileSnapshot(settings, userId);
    const snapshot = await getDocs(
      query(collection(firestore, COMMUNITY_COLLECTION), where("ownerId", "==", userId)),
    );
    const batch = writeBatch(firestore);

    snapshot.docs.forEach((item) => {
      batch.update(item.ref, {
        author: profile.author,
        username: profile.username,
        avatar: profile.avatar,
        avatarInitials: profile.avatarInitials,
        city: profile.city,
        note: profile.note,
        updatedAt: serverTimestamp(),
      });
    });

    if (!snapshot.empty) await batch.commit();
  },

  async syncPublicProfile(settings, userId = currentUserId) {
    if (!userId || apiEnabled()) return;

    await setDoc(publicProfileDoc(userId), buildPublicProfile(settings, userId), {
      merge: true,
    });
  },

  async getPublicProfile(userId) {
    if (!userId) return null;

    if (apiEnabled()) {
      return apiRequest(`/community/users/${userId}`);
    }

    const [profileSnapshot, goalsSnapshot] = await Promise.all([
      getDoc(publicProfileDoc(userId)),
      getDocs(query(collection(firestore, COMMUNITY_COLLECTION), where("ownerId", "==", userId))),
    ]);

    const goals = goalsSnapshot.docs.map((item) =>
      normalizeCommunityGoal({ id: item.id, ...item.data() }),
    );
    const totalProgress = goals.reduce((sum, goal) => {
      const target = Number(goal.targetValue) || 0;
      return sum + (target ? Math.min((Number(goal.savedValue) / target) * 100, 100) : 0);
    }, 0);

    return {
      id: userId,
      userId,
      author: "Usuario Engine",
      username: "@engine",
      avatar: "",
      avatarInitials: "UE",
      city: "Engine Garage",
      note: "",
      ...(profileSnapshot.exists() ? profileSnapshot.data() : {}),
      goals,
      goalsCount: goals.length,
      likesCount: goals.reduce((sum, goal) => sum + Object.keys(goal.likesBy || {}).length, 0),
      averageProgress: goals.length ? totalProgress / goals.length : 0,
    };
  },

  async notifyUser(userId, notification) {
    if (!userId || userId === currentUserId) return;

    await addDoc(userNotificationsCollection(userId), {
      ...notification,
      read: false,
      createdAt: serverTimestamp(),
    });
  },

  async notifyFollow(userId) {
    if (!userId || userId === currentUserId) return;

    if (apiEnabled()) {
      await apiRequest(`/community/users/${userId}/follow`, { method: "POST" });
      return;
    }

    const actorSettings = await this.getSettings();
    const actor = getProfileSnapshot(actorSettings, currentUserId);
    await this.notifyUser(userId, {
      type: "follow",
      actorId: currentUserId,
      actorName: actor.author,
      actorUsername: actor.username,
      text: `${actor.author} comecou a seguir sua garagem.`,
    });
  },

  subscribeNotifications(userId = currentUserId, callback) {
    if (!userId) return () => {};

    if (apiEnabled()) {
      let active = true;
      const load = async () => {
        try {
          const notifications = await apiRequest("/notifications");
          if (active) callback(notifications);
        } catch (error) {
          warnFirestoreFallback("subscribeNotifications", error);
          if (active) callback([]);
        }
      };
      load();
      const interval = window.setInterval(load, 10000);
      return () => {
        active = false;
        window.clearInterval(interval);
      };
    }

    return onSnapshot(
      query(userNotificationsCollection(userId), orderBy("createdAt", "desc")),
      (snapshot) => {
        callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => {
        warnFirestoreFallback("subscribeNotifications", error);
        callback([]);
      },
    );
  },

  async markNotificationsRead(userId = currentUserId) {
    if (!userId) return;

    if (apiEnabled()) {
      await apiRequest("/notifications/read", { method: "PATCH" });
      return;
    }

    const snapshot = await getDocs(userNotificationsCollection(userId));
    const batch = writeBatch(firestore);
    snapshot.docs
      .filter((item) => !item.data().read)
      .forEach((item) => batch.update(item.ref, { read: true }));

    if (!snapshot.empty) await batch.commit();
  },

  async toggleCommunityLike(goalId, liked, userId = currentUserId) {
    if (!userId) return;

    if (apiEnabled()) {
      await apiJson("PATCH", `/community/goals/${goalId}/like`, { liked });
      return;
    }

    const goalRef = doc(firestore, COMMUNITY_COLLECTION, goalId);
    const goal = await getDoc(goalRef);
    const goalData = goal.exists() ? goal.data() : null;

    await updateDoc(doc(firestore, COMMUNITY_COLLECTION, goalId), {
      [`likesBy.${userId}`]: liked ? true : deleteField(),
      updatedAt: serverTimestamp(),
    });

    if (liked && goalData) {
      const actorSettings = await this.getSettings();
      const actor = getProfileSnapshot(actorSettings, userId);
      await this.notifyUser(goalData.ownerId, {
        type: "like",
        actorId: userId,
        actorName: actor.author,
        actorUsername: actor.username,
        goalId,
        goalTitle: goalData.title,
        text: `${actor.author} curtiu sua meta ${goalData.title}.`,
      });
    }
  },

  async addCommunityComment(goalId, comment, userId = currentUserId) {
    if (!userId) return;

    if (apiEnabled()) {
      await apiJson("POST", `/community/goals/${goalId}/comments`, { comment });
      return;
    }

    const goalRef = doc(firestore, COMMUNITY_COLLECTION, goalId);
    const goal = await getDoc(goalRef);
    const goalData = goal.exists() ? goal.data() : null;
    const actorSettings = await this.getSettings();
    const actor = getProfileSnapshot(actorSettings, userId);

    await updateDoc(goalRef, {
      comments: arrayUnion({
        userId,
        author: actor.author,
        username: actor.username,
        avatar: actor.avatar,
        avatarInitials: actor.avatarInitials,
        text: String(comment).trim().slice(0, 180),
        createdAt: new Date().toISOString(),
      }),
      updatedAt: serverTimestamp(),
    });

    if (goalData) {
      await this.notifyUser(goalData.ownerId, {
        type: "comment",
        actorId: userId,
        actorName: actor.author,
        actorUsername: actor.username,
        goalId,
        goalTitle: goalData.title,
        text: `${actor.author} comentou na sua meta ${goalData.title}.`,
      });
    }
  },

  async rateCommunityGoal(goalId, rating, userId = currentUserId) {
    if (!userId) return;

    if (apiEnabled()) {
      await apiJson("PATCH", `/community/goals/${goalId}/rating`, { rating });
      return;
    }

    const goalRef = doc(firestore, COMMUNITY_COLLECTION, goalId);
    const goal = await getDoc(goalRef);
    const goalData = goal.exists() ? goal.data() : null;

    await updateDoc(goalRef, {
      [`ratingsBy.${userId}`]: Math.max(1, Math.min(Number(rating) || 1, 5)),
      updatedAt: serverTimestamp(),
    });

    if (goalData && goalData.ownerId !== userId) {
      const actorSettings = await this.getSettings();
      const actor = getProfileSnapshot(actorSettings, userId);
      await this.notifyUser(goalData.ownerId, {
        type: "rating",
        actorId: userId,
        actorName: actor.author,
        actorUsername: actor.username,
        goalId,
        goalTitle: goalData.title,
        text: `${actor.author} avaliou sua meta ${goalData.title}.`,
      });
    }
  },

  async getSettings() {
    if (!currentUserId) {
      const settings = await getLocalSettings();
      return normalizeSettings(settings);
    }

    if (apiEnabled()) {
      const settings = normalizeSettings(await apiRequest("/settings"));
      await setLocalSettings(settings);
      return settings;
    }

    try {
      const snapshot = await withTimeout(
        getDoc(userSettingsDoc()),
        "buscar configuracoes",
      );
      const settings = snapshot.exists() ? snapshot.data() : {};
      const normalized = normalizeSettings(settings);
      await setLocalSettings(normalized);
      return normalized;
    } catch (error) {
      warnFirestoreFallback("getSettings", error);
      const settings = await getLocalSettings();
      return normalizeSettings(settings);
    }
  },

  async saveSettings(settings, userId = currentUserId) {
    const mergedSettings = normalizeSettings(settings);

    if (!userId) {
      await this.reserveUsername(mergedSettings.profile.username, userId);
      await setLocalSettings(mergedSettings, userId);
      return mergedSettings;
    }

    if (apiEnabled()) {
      const savedSettings = normalizeSettings(
        await apiJson("PUT", "/settings", mergedSettings),
      );
      await setLocalSettings(savedSettings, userId);
      return savedSettings;
    }

    await this.reserveUsername(mergedSettings.profile.username, userId);

    try {
      await withTimeout(
        setDoc(userSettingsDoc(userId), serializeForFirestore(mergedSettings), {
          merge: true,
        }),
        "salvar configuracoes",
      );
    } catch (error) {
      warnFirestoreFallback("saveSettings", error);
    }

    await setLocalSettings(mergedSettings, userId);
    await this.syncPublicProfile(mergedSettings, userId).catch((error) =>
      warnFirestoreFallback("syncPublicProfile", error),
    );
    await this.syncCommunityProfile(mergedSettings, userId).catch((error) =>
      warnFirestoreFallback("syncCommunityProfile", error),
    );
    return mergedSettings;
  },

  async resetSettings() {
    if (!currentUserId) {
      await del(LEGACY_SETTINGS_KEY);
      return defaultSettings;
    }

    if (apiEnabled()) {
      return normalizeSettings(await apiRequest("/settings", { method: "DELETE" }));
    }

    await deleteDoc(userSettingsDoc());
    return defaultSettings;
  },

  async reserveUsername(username, userId = currentUserId) {
    const normalized = normalizeUsername(username);
    if (!normalized) return "";

    if (!userId || userId === "pending") {
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
    }

    const usernameRef = doc(firestore, USERNAMES_COLLECTION, usernameDocId(normalized));
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(usernameRef);
      const owner = snapshot.exists() ? snapshot.data().userId : null;

      if (owner && owner !== userId) {
        throw new Error("Este usuario ja esta em uso.");
      }

      transaction.set(usernameRef, {
        username: normalized,
        userId,
        updatedAt: serverTimestamp(),
      });
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
