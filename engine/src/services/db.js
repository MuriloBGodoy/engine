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
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, firestore } from "./firebase";
import { inferLocation } from "./locations";
import { normalizeOwnershipInputs } from "./ownership";

const defaultSettings = {
  profile: {
    displayName: "",
    username: "",
    phone: "",
    country: "BR",
    state: "",
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
    navLayout: "sidebar",
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
const SERVICE_LISTINGS_COLLECTION = "serviceListings";
const SERVICE_STATUS_APPROVED = "approved";
const SERVICE_STATUS_PENDING = "pending";
const SERVICE_STATUS_CHANGES_REQUESTED = "changes_requested";
const SERVICE_STATUS_REJECTED = "rejected";
const FIRESTORE_TIMEOUT_MS = 7000;
const ENGINE_API_URL = import.meta.env.VITE_API_URL || "";
const COMMUNITY_GOALS_PAGE_SIZE = 20;
const defaultCommunityState = {
  interactions: {},
  following: [],
  sharedGoalIds: [],
  savedVideos: [],
};
let currentUserId = null;
let communityGoalsCursorDoc = null;
let communityGoalsHasMore = true;

const apiEnabled = () => Boolean(ENGINE_API_URL && auth.currentUser);

const apiRequest = async (path, options = {}) => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Usuário não autenticado.");
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
    throw new Error("Usuário não identificado.");
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
      country: String(merged.profile.country || "").trim().slice(0, 4).toUpperCase(),
      state: String(merged.profile.state || "").trim().slice(0, 8).toUpperCase(),
      location: merged.profile.location.trim().slice(0, 80),
      bio: merged.profile.bio.trim().slice(0, 280),
    },
  };
};

const recoverSettingsAvatar = async (settings = {}, userId = currentUserId) => {
  const normalized = normalizeSettings(settings);
  if (normalized.profile.avatar || !userId) return normalized;

  const localSettings = await getLocalSettings(userId);
  const localAvatar = localSettings?.profile?.avatar || "";
  if (localAvatar) {
    return {
      ...normalized,
      profile: { ...normalized.profile, avatar: localAvatar },
    };
  }

  try {
    const profileSnapshot = await getDoc(publicProfileDoc(userId));
    const publicAvatar = profileSnapshot.exists()
      ? profileSnapshot.data()?.avatar || ""
      : "";
    if (publicAvatar) {
      return {
        ...normalized,
        profile: { ...normalized.profile, avatar: publicAvatar },
      };
    }
  } catch (error) {
    warnFirestoreFallback("recoverSettingsAvatar", error);
  }

  const authAvatar = auth.currentUser?.photoURL || "";
  return authAvatar
    ? {
        ...normalized,
        profile: { ...normalized.profile, avatar: authAvatar },
      }
    : normalized;
};

export const MAX_CAR_PHOTOS = 4;

/** Galeria do carro: aceita o campo antigo (`image`) e o novo (`images`). */
const normalizeCarImages = (car = {}) => {
  const list = Array.isArray(car.images) ? car.images : [];
  const all = list
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return Array.from(new Set(all)).slice(0, MAX_CAR_PHOTOS);
};

const normalizeCar = (car) => ({
  id: String(car.id || crypto.randomUUID()),
  brand: String(car.brand || "").trim().slice(0, 80),
  model: String(car.model || "").trim().slice(0, 120),
  year: String(car.year || "").trim().slice(0, 40),
  targetValue: Math.max(Number(car.targetValue) || 0, 0),
  savedValue: Math.max(Number(car.savedValue) || 0, 0),
  images: normalizeCarImages(car),
  // `image` continua sendo a capa, para tudo que já lê esse campo.
  image: normalizeCarImages(car)[0] || "",
  // Simulação de custo real de posse (inputs do usuário), quando existir.
  ownership: car.ownership
    ? {
        ...normalizeOwnershipInputs(car.ownership),
        country: String(car.ownership.country || "").trim().slice(0, 4).toUpperCase(),
        state: String(car.ownership.state || "").trim().slice(0, 8).toUpperCase(),
      }
    : null,
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
    throw new Error("Usuário não identificado.");
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

const publicProfilesCollection = () => collection(firestore, PUBLIC_PROFILES_COLLECTION);

const publicProfileDoc = (userId) =>
  doc(firestore, PUBLIC_PROFILES_COLLECTION, String(userId));

const followersCollection = (userId) =>
  collection(firestore, PUBLIC_PROFILES_COLLECTION, String(userId), "followers");

const followerDoc = (targetUserId, followerId) =>
  doc(
    firestore,
    PUBLIC_PROFILES_COLLECTION,
    String(targetUserId),
    "followers",
    String(followerId),
  );

const usernameDocId = (username) => normalizeUsername(username).replace(/^@/, "");

const getProfileSnapshot = (settings = {}, userId = currentUserId) => {
  const profile = settings.profile || {};
  const author = profile.displayName || "Usuário Engine";
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

const buildCommunityGoal = (goal, userId, settings = {}, note = "") => {
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
    images: normalizeCarImages(goal),
    savedValue: goal.savedValue,
    targetValue: goal.targetValue,
    // Legenda escrita na hora de publicar — não é mais a bio do perfil.
    note: String(note || "").trim().slice(0, 280),
    verified: true,
    likesBy: {},
    comments: [],
    ratingsBy: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

const communityGoalId = (goal, userId = currentUserId) => {
  const goalId = String(goal?.id || "");
  if (goalId.startsWith("goal-")) return goalId;

  const carId = String(goal?.carId || goalId.replace(/^user-/, ""));
  return `goal-${userId}-${carId}`;
};

const legacyCommunityGoalId = (goal, userId = currentUserId) => {
  const goalId = String(goal?.id || "");
  if (goalId.startsWith("goal-")) return goalId;

  const carId = String(goal?.carId || goalId.replace(/^user-/, ""));
  return `goal-${userId}-user-${carId}`;
};

const communityCarPatch = (car) => ({
  carId: String(car.id),
  title: `${car.brand} ${car.model}`.trim(),
  brand: car.brand,
  model: car.model,
  year: car.year,
  image: car.image,
  images: normalizeCarImages(car),
  savedValue: car.savedValue,
  targetValue: car.targetValue,
  updatedAt: serverTimestamp(),
});

const normalizeCommunityGoal = (goal = {}) => {
  const ratings = Object.values(goal.ratingsBy || {}).map(Number).filter(Boolean);
  const rating = ratings.length
    ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
    : 0;
  const author = goal.author || "Usuário Engine";

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
    images: normalizeCarImages(goal),
    savedValue: Number(goal.savedValue) || 0,
    targetValue: Number(goal.targetValue) || 0,
    streak: Number(goal.streak) || 1,
    likes: Object.keys(goal.likesBy || {}).length,
    comments: (goal.comments || []).map((comment) =>
      typeof comment === "string"
        ? { text: comment, author: "Engine", username: "@engine" }
        : {
            text: comment.text,
            id: comment.id || comment.createdAt || crypto.randomUUID(),
            author: comment.author || "Usuário Engine",
            username: comment.username || "@engine",
            avatar: comment.avatar || comment.avatarInitials || "",
            avatarInitials: comment.avatarInitials || "",
            userId: comment.userId || "",
            createdAt: comment.createdAt || "",
            editedAt: comment.editedAt || "",
          },
    ),
    rating: rating || 0,
    verified: Boolean(goal.verified),
    tagKey: "community.seed.mine",
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

const normalizeServiceListing = (listing = {}) => {
  const title = String(listing.title || "").trim().slice(0, 90);
  const providerName = String(listing.providerName || "").trim().slice(0, 80);
  let country = String(listing.country || "").trim().slice(0, 4).toUpperCase();
  let state = String(listing.state || "").trim().slice(0, 8).toUpperCase();
  const city = String(listing.city || "").trim().slice(0, 80);
  // Anúncios legados (sem país/estado): tenta inferir pela cidade, se o nome
  // for único no dataset. Assim eles deixam de aparecer "soltos" no filtro.
  if ((!country || !state) && city) {
    const inferred = inferLocation(city);
    if (inferred) {
      country = country || inferred.country;
      state = state || inferred.state;
    }
  }
  const address = String(listing.address || "").trim().slice(0, 160);
  const whatsappCountry = String(listing.whatsappCountry || "+55")
    .trim()
    .replace(/[^\d+]/g, "")
    .slice(0, 6);
  const whatsapp = normalizePhone(
    listing.whatsapp && !String(listing.whatsapp).trim().startsWith("+")
      ? `${whatsappCountry} ${listing.whatsapp}`
      : listing.whatsapp || "",
  );
  const email = String(listing.email || "")
    .trim()
    .toLowerCase()
    .slice(0, 120);

  return {
    id: String(listing.id || crypto.randomUUID()),
    ownerId: String(listing.ownerId || currentUserId || ""),
    title,
    providerName,
    category: String(listing.category || "").trim().slice(0, 60),
    description: String(listing.description || "").trim().slice(0, 900),
    price: String(listing.price || "").trim().slice(0, 80),
    serviceMode: ["place", "mobile", "hybrid"].includes(listing.serviceMode)
      ? listing.serviceMode
      : "hybrid",
    country,
    state,
    city,
    address,
    serviceArea: String(listing.serviceArea || "").trim().slice(0, 160),
    whatsappCountry,
    whatsapp,
    email,
    website: String(listing.website || "").trim().slice(0, 160),
    availability: String(listing.availability || "").trim().slice(0, 180),
    experience: String(listing.experience || "").trim().slice(0, 180),
    photos: Array.isArray(listing.photos)
      ? listing.photos
          .map((photo) => String(photo || "").trim())
          .filter(Boolean)
          .slice(0, 6)
      : [],
    moderationStatus: [
      SERVICE_STATUS_APPROVED,
      SERVICE_STATUS_PENDING,
      SERVICE_STATUS_CHANGES_REQUESTED,
      SERVICE_STATUS_REJECTED,
    ].includes(
      listing.moderationStatus,
    )
      ? listing.moderationStatus
      : SERVICE_STATUS_PENDING,
    moderationNote: String(listing.moderationNote || "").trim().slice(0, 600),
    moderationHistory: Array.isArray(listing.moderationHistory)
      ? listing.moderationHistory
          .map((entry) => ({
            status: String(entry?.status || "").trim(),
            note: String(entry?.note || "").trim().slice(0, 600),
            reviewerId: String(entry?.reviewerId || entry?.reviewedBy || "").trim(),
            reviewedAt: entry?.reviewedAt || entry?.createdAt || "",
          }))
          .filter((entry) => entry.status)
          .slice(0, 20)
      : [],
    reviewedBy: String(listing.reviewedBy || "").trim(),
    reviewedAt: listing.reviewedAt || "",
    submittedAt: listing.submittedAt || listing.createdAt || new Date().toISOString(),
    tags: Array.isArray(listing.tags)
      ? listing.tags.map((tag) => String(tag).trim().slice(0, 28)).filter(Boolean).slice(0, 8)
      : String(listing.tags || "")
          .split(",")
          .map((tag) => tag.trim().slice(0, 28))
          .filter(Boolean)
          .slice(0, 8),
    subscriptionStatus: listing.subscriptionStatus || "preview_unlocked",
    active: listing.active !== false,
    createdAt: listing.createdAt || new Date().toISOString(),
    updatedAt: listing.updatedAt || new Date().toISOString(),
  };
};

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
      await this.syncCommunityCar(normalizedCar).catch((error) =>
        warnFirestoreFallback("syncCommunityCar", error),
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
        withTimeout(
          deleteDoc(doc(firestore, COMMUNITY_COLLECTION, `goal-${currentUserId}-user-${id}`)),
          "excluir post legado da comunidade",
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
          if (active) callback(goals, { hasMore: false });
        } catch (error) {
          warnFirestoreFallback("subscribeCommunityGoals", error);
          if (active) callback([], { hasMore: false });
        }
      };
      load();
      const interval = window.setInterval(load, 10000);
      return () => {
        active = false;
        window.clearInterval(interval);
      };
    }

    communityGoalsCursorDoc = null;
    communityGoalsHasMore = true;

    const communityQuery = query(
      collection(firestore, COMMUNITY_COLLECTION),
      orderBy("updatedAt", "desc"),
      limit(COMMUNITY_GOALS_PAGE_SIZE),
    );

    return onSnapshot(
      communityQuery,
      (snapshot) => {
        communityGoalsCursorDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        communityGoalsHasMore = snapshot.docs.length === COMMUNITY_GOALS_PAGE_SIZE;
        callback(
          snapshot.docs.map((item) =>
            normalizeCommunityGoal({ id: item.id, ...item.data() }),
          ),
          { hasMore: communityGoalsHasMore },
        );
      },
      (error) => {
        warnFirestoreFallback("subscribeCommunityGoals", error);
        callback([], { hasMore: false });
      },
    );
  },

  async loadMoreCommunityGoals() {
    if (apiEnabled() || !communityGoalsCursorDoc || !communityGoalsHasMore) {
      return { goals: [], hasMore: false };
    }

    const nextPageQuery = query(
      collection(firestore, COMMUNITY_COLLECTION),
      orderBy("updatedAt", "desc"),
      startAfter(communityGoalsCursorDoc),
      limit(COMMUNITY_GOALS_PAGE_SIZE),
    );

    const snapshot = await getDocs(nextPageQuery);
    communityGoalsCursorDoc = snapshot.docs[snapshot.docs.length - 1] || communityGoalsCursorDoc;
    communityGoalsHasMore = snapshot.docs.length === COMMUNITY_GOALS_PAGE_SIZE;

    return {
      goals: snapshot.docs.map((item) =>
        normalizeCommunityGoal({ id: item.id, ...item.data() }),
      ),
      hasMore: communityGoalsHasMore,
    };
  },

  /**
   * Acompanha UMA publicação — usada pelo modal de post aberto por link direto
   * ou notificação, quando a meta não está na página já carregada do feed.
   */
  subscribeCommunityGoal(goalId, callback) {
    if (!goalId) {
      callback(null);
      return () => {};
    }

    if (apiEnabled()) {
      let active = true;
      apiRequest(`/community/goals/${goalId}`)
        .then((goal) => {
          if (active) callback(goal);
        })
        .catch((error) => {
          warnFirestoreFallback("subscribeCommunityGoal", error);
          if (active) callback(null);
        });
      return () => {
        active = false;
      };
    }

    return onSnapshot(
      doc(firestore, COMMUNITY_COLLECTION, String(goalId)),
      (snapshot) => {
        callback(
          snapshot.exists()
            ? normalizeCommunityGoal({ id: snapshot.id, ...snapshot.data() })
            : null,
        );
      },
      (error) => {
        warnFirestoreFallback("subscribeCommunityGoal", error);
        callback(null);
      },
    );
  },

  subscribePublicProfiles(callback) {
    if (apiEnabled()) {
      apiRequest("/community/users")
        .then((profiles = {}) => {
          const map = {};
          Object.values(profiles).forEach((profile) => {
            const id = profile.userId || profile.id;
            map[id] = profile;
          });
          callback(map);
        })
        .catch((error) => {
          console.warn("[db] subscribePublicProfiles (API)", error);
          callback({});
        });
      return () => {};
    }

    return onSnapshot(
      publicProfilesCollection(),
      (snapshot) => {
        const profiles = {};
        snapshot.docs.forEach((item) => {
          const data = { id: item.id, ...item.data() };
          profiles[item.id] = data;
          if (data.userId) profiles[data.userId] = data;
        });
        callback(profiles);
      },
      (error) => {
        warnFirestoreFallback("subscribePublicProfiles", error);
        callback({});
      },
    );
  },

  subscribeServiceListings(callback, options = {}) {
    const isAdmin = Boolean(options.isAdmin);
    const userId = options.userId || currentUserId;
    const listingsQuery = isAdmin
      ? query(
          collection(firestore, SERVICE_LISTINGS_COLLECTION),
          orderBy("updatedAt", "desc"),
        )
      : query(
          collection(firestore, SERVICE_LISTINGS_COLLECTION),
          where("moderationStatus", "==", SERVICE_STATUS_APPROVED),
        );

    return onSnapshot(
      listingsQuery,
      (snapshot) => {
        const publicListings = snapshot.docs
          .map((item) => normalizeServiceListing({ id: item.id, ...item.data() }))
          .filter((listing) => listing.active)
          .sort((a, b) =>
            String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
          );

        if (isAdmin || !userId) {
          callback(publicListings);
          return;
        }

        const ownerQuery = query(
          collection(firestore, SERVICE_LISTINGS_COLLECTION),
          where("ownerId", "==", userId),
        );

        getDocs(ownerQuery)
          .then((ownerSnapshot) => {
            const byId = new Map(publicListings.map((listing) => [listing.id, listing]));
            ownerSnapshot.docs
              .map((item) => normalizeServiceListing({ id: item.id, ...item.data() }))
              .filter((listing) => listing.active)
              .forEach((listing) => byId.set(listing.id, listing));
            callback(
              Array.from(byId.values()).sort((a, b) =>
                String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
              ),
            );
          })
          .catch((error) => {
            warnFirestoreFallback("subscribeServiceListingsOwner", error);
            callback(publicListings);
          });
      },
      async (error) => {
        warnFirestoreFallback("subscribeServiceListings", error);
        const localListings = (await get("engine_service_listings")) || [];
        callback(
          localListings
            .map(normalizeServiceListing)
            .filter((listing) => listing.active)
            .filter(
              (listing) =>
                isAdmin ||
                listing.ownerId === userId ||
                listing.moderationStatus === SERVICE_STATUS_APPROVED,
            ),
        );
      },
    );
  },

  async saveServiceListing(listing, settings = {}, userId = currentUserId, options = {}) {
    if (!userId) throw new Error("Usuario nao identificado.");

    const isAdmin = Boolean(options.isAdmin);
    const profile = getProfileSnapshot(settings, userId);
    const existingStatus = listing.moderationStatus || SERVICE_STATUS_PENDING;
    const moderationStatus =
      isAdmin && existingStatus === SERVICE_STATUS_APPROVED
        ? SERVICE_STATUS_APPROVED
        : SERVICE_STATUS_PENDING;
    const normalized = normalizeServiceListing({
      ...listing,
      ownerId: isAdmin && listing.ownerId ? listing.ownerId : userId,
      providerName: listing.providerName || profile.author,
      country: listing.country || settings?.profile?.country || "",
      state: listing.state || settings?.profile?.state || "",
      city: listing.city || profile.city,
      email: listing.email || auth.currentUser?.email || "",
      moderationStatus,
      moderationNote: moderationStatus === SERVICE_STATUS_PENDING ? "" : listing.moderationNote,
      reviewedAt: moderationStatus === SERVICE_STATUS_PENDING ? "" : listing.reviewedAt,
      reviewedBy: moderationStatus === SERVICE_STATUS_PENDING ? "" : listing.reviewedBy,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      await withTimeout(
        setDoc(
          doc(firestore, SERVICE_LISTINGS_COLLECTION, normalized.id),
          {
            ...serializeForFirestore(normalized),
            updatedAt: serverTimestamp(),
            createdAt: listing.createdAt || serverTimestamp(),
          },
          { merge: true },
        ),
        "salvar anuncio de servico",
      );
    } catch (error) {
      warnFirestoreFallback("saveServiceListing", error);
    }

    const localListings = (await get("engine_service_listings")) || [];
    const index = localListings.findIndex((item) => item.id === normalized.id);
    if (index >= 0) {
      localListings[index] = normalized;
    } else {
      localListings.unshift(normalized);
    }
    await set("engine_service_listings", localListings);
    return normalized;
  },

  async moderateServiceListing(listingId, status, note = "", reviewerId = currentUserId) {
    if (!listingId || !reviewerId) return;
    if (
      ![
        SERVICE_STATUS_APPROVED,
        SERVICE_STATUS_CHANGES_REQUESTED,
        SERVICE_STATUS_REJECTED,
      ].includes(status)
    ) {
      throw new Error("Status de moderacao invalido.");
    }

    const listingRef = doc(firestore, SERVICE_LISTINGS_COLLECTION, String(listingId));
    const listingSnapshot = await getDoc(listingRef).catch((error) => {
      warnFirestoreFallback("moderateServiceListing.get", error);
      return null;
    });
    const listing = listingSnapshot?.exists()
      ? normalizeServiceListing({ id: listingSnapshot.id, ...listingSnapshot.data() })
      : ((await get("engine_service_listings")) || [])
          .map(normalizeServiceListing)
          .find((item) => item.id === String(listingId));
    const cleanNote = String(note || "").trim().slice(0, 600);
    const reviewedAt = new Date().toISOString();
    const historyEntry = {
      status,
      note: cleanNote,
      reviewerId,
      reviewedAt,
    };
    const patch = {
      moderationStatus: status,
      moderationNote: cleanNote,
      reviewedBy: reviewerId,
      reviewedAt,
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(listingRef, {
        ...patch,
        moderationHistory: arrayUnion(historyEntry),
      });
    } catch (error) {
      warnFirestoreFallback("moderateServiceListing.update", error);
    }

    const localListings = (await get("engine_service_listings")) || [];
    const localIndex = localListings.findIndex((item) => item.id === String(listingId));
    if (localIndex >= 0) {
      localListings[localIndex] = normalizeServiceListing({
        ...localListings[localIndex],
        ...patch,
        updatedAt: reviewedAt,
        moderationHistory: [
          ...(localListings[localIndex].moderationHistory || []),
          historyEntry,
        ],
      });
      await set("engine_service_listings", localListings);
    }

    if (listing?.ownerId) {
      const notificationType =
        status === SERVICE_STATUS_APPROVED
          ? "service_approved"
          : status === SERVICE_STATUS_CHANGES_REQUESTED
            ? "service_changes_requested"
            : "service_rejected";
      const notificationText =
        status === SERVICE_STATUS_APPROVED
          ? `Seu anuncio ${listing.title} foi aprovado e publicado.`
          : status === SERVICE_STATUS_CHANGES_REQUESTED
            ? `Seu anuncio ${listing.title} voltou para ajustes.`
            : `Seu anuncio ${listing.title} foi recusado.`;

      await this.notifyUser(listing.ownerId, {
        type: notificationType,
        actorId: reviewerId,
        serviceId: String(listingId),
        serviceTitle: listing.title,
        moderationNote: patch.moderationNote,
        targetPath: "/services",
        notificationTitle:
          status === SERVICE_STATUS_APPROVED
            ? "Anúncio aprovado"
            : status === SERVICE_STATUS_CHANGES_REQUESTED
              ? "Alterações solicitadas"
              : "Anúncio recusado",
        notificationBody:
          status === SERVICE_STATUS_APPROVED
            ? "Seu anúncio foi publicado."
            : status === SERVICE_STATUS_CHANGES_REQUESTED
              ? "Revise os comentários do admin."
              : "Confira o motivo enviado pelo admin.",
        text: notificationText,
      });
    }
  },

  async deleteServiceListing(listingId, userId = currentUserId) {
    if (!listingId || !userId) return;

    try {
      await withTimeout(
        deleteDoc(doc(firestore, SERVICE_LISTINGS_COLLECTION, String(listingId))),
        "excluir anuncio de servico",
      );
    } catch (error) {
      warnFirestoreFallback("deleteServiceListing", error);
    }

    const localListings = (await get("engine_service_listings")) || [];
    await set(
      "engine_service_listings",
      localListings.filter((item) => item.id !== String(listingId)),
    );
  },

  async shareCommunityGoal(goal, settings, userId = currentUserId, note = "") {
    if (!userId) throw new Error("Usuário não identificado.");

    if (apiEnabled()) {
      const response = await apiJson("POST", "/community/goals", { ...goal, note });
      return response.id;
    }

    const payload = buildCommunityGoal(goal, userId, settings, note);
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

  /** Edita só a legenda de uma publicação já no ar. */
  async updateCommunityGoalNote(goalId, note, userId = currentUserId) {
    if (!userId || !goalId) return;

    const text = String(note || "").trim().slice(0, 280);

    if (apiEnabled()) {
      await apiJson("PATCH", `/community/goals/${goalId}`, { note: text });
      return;
    }

    await updateDoc(doc(firestore, COMMUNITY_COLLECTION, String(goalId)), {
      note: text,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteCommunityGoal(goal, userId = currentUserId) {
    if (!userId) return;
    const goalId = communityGoalId(goal, userId);

    if (apiEnabled()) {
      await apiRequest(`/community/goals/${goalId}`, { method: "DELETE" });
      return;
    }

    await Promise.all([
      deleteDoc(doc(firestore, COMMUNITY_COLLECTION, goalId)),
      deleteDoc(doc(firestore, COMMUNITY_COLLECTION, legacyCommunityGoalId(goal, userId))),
    ]);
  },

  async resetMyCommunityPublications(userId = currentUserId) {
    if (!userId) return;

    if (apiEnabled()) {
      await apiRequest("/community/goals", { method: "DELETE" });
      return;
    }

    const snapshot = await getDocs(
      query(collection(firestore, COMMUNITY_COLLECTION), where("ownerId", "==", userId)),
    );
    const batch = writeBatch(firestore);
    snapshot.docs.forEach((item) => batch.delete(item.ref));
    if (!snapshot.empty) await batch.commit();
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

  async syncCommunityCar(car, userId = currentUserId) {
    if (!userId || apiEnabled()) return;

    const goalIds = [
      communityGoalId(car, userId),
      legacyCommunityGoalId(car, userId),
    ];
    const batch = writeBatch(firestore);
    let hasUpdates = false;

    await Promise.all(
      goalIds.map(async (goalId) => {
        const goalRef = doc(firestore, COMMUNITY_COLLECTION, goalId);
        const snapshot = await getDoc(goalRef);
        if (!snapshot.exists()) return;
        batch.update(goalRef, communityCarPatch(car));
        hasUpdates = true;
      }),
    );

    if (hasUpdates) await batch.commit();
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

    const [profileSnapshot, goalsSnapshot, followersSnapshot, myFollowSnapshot] =
      await Promise.all([
        getDoc(publicProfileDoc(userId)),
        getDocs(query(collection(firestore, COMMUNITY_COLLECTION), where("ownerId", "==", userId))),
        getDocs(followersCollection(userId)).catch(() => ({ size: 0 })),
        currentUserId && currentUserId !== userId
          ? getDoc(followerDoc(userId, currentUserId)).catch(() => null)
          : Promise.resolve(null),
      ]);

    const goals = goalsSnapshot.docs.map((item) =>
      normalizeCommunityGoal({ id: item.id, ...item.data() }),
    );
    const totalProgress = goals.reduce((sum, goal) => {
      const target = Number(goal.targetValue) || 0;
      return sum + (target ? Math.min((Number(goal.savedValue) / target) * 100, 100) : 0);
    }, 0);

    // O doc em publicProfiles só nasce quando a pessoa salva os ajustes; até
    // lá, os dados do autor que viajam junto de cada meta são a melhor fonte
    // (antes caíamos num "Usuário Engine / @engine" genérico).
    const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
    const fromGoals = goals[0] || {};
    const pick = (...values) => values.find(Boolean) || "";

    return {
      id: userId,
      userId,
      ...profile,
      author: pick(profile.author, fromGoals.author, "Usuário Engine"),
      username: pick(profile.username, fromGoals.username, "@engine"),
      avatar: pick(profile.avatar, fromGoals.avatar),
      avatarInitials: pick(profile.avatarInitials, fromGoals.avatarInitials),
      city: pick(profile.city, fromGoals.city, "Engine Garage"),
      note: pick(profile.note, fromGoals.note),
      goals,
      goalsCount: goals.length,
      likesCount: goals.reduce((sum, goal) => sum + Object.keys(goal.likesBy || {}).length, 0),
      averageProgress: goals.length ? totalProgress / goals.length : 0,
      followersCount: followersSnapshot?.size || 0,
      isFollowedByMe: Boolean(myFollowSnapshot?.exists?.()),
    };
  },

  // Segue / deixa de seguir uma pessoa: grava (ou remove) o doc do seguidor
  // em publicProfiles/{alvo}/followers/{eu}. A notificação de novo seguidor
  // continua saindo de quem chama (Community.handleFollow).
  async setFollow(targetUserId, isFollowing, followerId = currentUserId) {
    if (!targetUserId || !followerId || targetUserId === followerId) return;

    if (apiEnabled()) {
      await apiRequest(`/community/users/${targetUserId}/follow`, {
        method: isFollowing ? "POST" : "DELETE",
      });
      return;
    }

    const ref = followerDoc(targetUserId, followerId);
    if (isFollowing) {
      const actorSettings = await this.getSettings();
      const actor = getProfileSnapshot(actorSettings, followerId);
      await setDoc(ref, {
        followerId,
        author: actor.author,
        username: actor.username,
        avatar: actor.avatar,
        avatarInitials: actor.avatarInitials,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(ref);
    }
  },

  async notifyUser(userId, notification) {
    const actorId = notification?.actorId || currentUserId;
    if (!userId || userId === actorId) return;

    await addDoc(userNotificationsCollection(userId), {
      ...notification,
      actorId,
      recipientId: userId,
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
      targetPath: `/community?user=${encodeURIComponent(currentUserId)}`,
      notificationTitle: "Novo seguidor",
      notificationBody: `${actor.author} começou a seguir sua garagem.`,
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
        targetPath: `/community?goal=${encodeURIComponent(goalId)}`,
        notificationTitle: "Nova curtida",
        notificationBody: `${actor.author} curtiu sua publicação.`,
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
    const commentId = crypto.randomUUID();

    await updateDoc(goalRef, {
      comments: arrayUnion({
        id: commentId,
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
        commentId,
        targetPath: `/community?goal=${encodeURIComponent(goalId)}&comments=1`,
        notificationTitle: "Novo comentário",
        notificationBody: `${actor.author} comentou na sua publicação.`,
        text: `${actor.author} comentou na sua meta ${goalData.title}.`,
      });
    }
  },

  async updateCommunityComment(goalId, commentId, text, userId = currentUserId) {
    if (!userId || !goalId || !commentId) return;

    const goalRef = doc(firestore, COMMUNITY_COLLECTION, String(goalId));
    const snapshot = await getDoc(goalRef);
    if (!snapshot.exists()) return;

    const comments = Array.isArray(snapshot.data().comments)
      ? snapshot.data().comments
      : [];
    const updatedComments = comments.map((comment) => {
      if (comment?.id !== commentId || comment?.userId !== userId) return comment;
      return {
        ...comment,
        text: String(text || "").trim().slice(0, 180),
        editedAt: new Date().toISOString(),
      };
    });

    await updateDoc(goalRef, {
      comments: updatedComments,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteCommunityComment(goalId, commentId, userId = currentUserId) {
    if (!userId || !goalId || !commentId) return;

    const goalRef = doc(firestore, COMMUNITY_COLLECTION, String(goalId));
    const snapshot = await getDoc(goalRef);
    if (!snapshot.exists()) return;

    const goalData = snapshot.data();
    const comments = Array.isArray(goalData.comments) ? goalData.comments : [];
    const updatedComments = comments.filter(
      (comment) =>
        comment?.id !== commentId ||
        (comment?.userId !== userId && goalData.ownerId !== userId),
    );

    await updateDoc(goalRef, {
      comments: updatedComments,
      updatedAt: serverTimestamp(),
    });
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
        targetPath: `/community?goal=${encodeURIComponent(goalId)}`,
        notificationTitle: "Nova avaliação",
        notificationBody: `${actor.author} avaliou sua publicação.`,
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
      const settings = await recoverSettingsAvatar(await apiRequest("/settings"));
      await setLocalSettings(settings);
      return settings;
    }

    try {
      const snapshot = await withTimeout(
        getDoc(userSettingsDoc()),
        "buscar configuracoes",
      );
      const settings = snapshot.exists() ? snapshot.data() : {};
      const normalized = await recoverSettingsAvatar(settings);
      await setLocalSettings(normalized);
      if (!settings?.profile?.avatar && normalized.profile.avatar) {
        setDoc(
          userSettingsDoc(),
          { profile: { avatar: normalized.profile.avatar } },
          { merge: true },
        ).catch((error) => warnFirestoreFallback("persistRecoveredAvatar", error));
      }
      return normalized;
    } catch (error) {
      warnFirestoreFallback("getSettings", error);
      const settings = await getLocalSettings();
      return recoverSettingsAvatar(settings);
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
        throw new Error("Este usuário já está em uso.");
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
        throw new Error("Este usuário já está em uso.");
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
