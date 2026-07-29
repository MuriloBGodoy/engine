import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, firestore } from "./firebase";

const EVENTS_COLLECTION = "events";

const normalizeEvent = (event) => ({
  title: String(event.title || "").trim().slice(0, 120),
  description: String(event.description || "").trim().slice(0, 1000),
  type: String(event.type || "casual").trim(),
  eventDate: String(event.eventDate || ""),
  endDate: String(event.endDate || "").trim(), // opcional
  startTime: String(event.startTime || "").trim(), // HH:mm
  endTime: String(event.endTime || "").trim(), // HH:mm (opcional)
  location: String(event.location || "").trim().slice(0, 120),
  state: String(event.state || "").trim().slice(0, 8),
  country: String(event.country || "BR").trim().slice(0, 4),
  image: String(event.image || "").trim(),
  isPaid: Boolean(event.isPaid),
  ticketPrice: Math.max(Number(event.ticketPrice) || 0, 0),
  maxParticipants: Math.max(Number(event.maxParticipants) || 0, 0),

  // Links de comunidade
  communityLinks: {
    whatsappGroup: String(event.communityLinks?.whatsappGroup || "").trim(),
    facebookGroup: String(event.communityLinks?.facebookGroup || "").trim(),
  },

  // Metadata
  createdBy: String(event.createdBy || ""),
  createdAt: event.createdAt || serverTimestamp(),
  updatedAt: event.updatedAt || serverTimestamp(),
  participantCount: Number(event.participantCount) || 0,
});

export const engineEvents = {
  async createEvent(eventData) {
    if (!auth.currentUser) throw new Error("Usuário não autenticado.");

    const normalized = normalizeEvent({
      ...eventData,
      createdBy: auth.currentUser.uid,
    });

    const docRef = await addDoc(collection(firestore, EVENTS_COLLECTION), normalized);
    return { id: docRef.id, ...normalized };
  },

  async getEventById(eventId) {
    const docRef = doc(firestore, EVENTS_COLLECTION, eventId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      throw new Error("Evento não encontrado.");
    }

    return { id: snapshot.id, ...snapshot.data() };
  },

  async getUpcomingEvents(filters = {}) {
    const { type, state, limit: resultLimit = 20 } = filters;

    let queryConstraints = [
      where("eventDate", ">=", new Date().toISOString()),
      orderBy("eventDate", "asc"),
    ];

    if (type && type !== "all") {
      queryConstraints.push(where("type", "==", type));
    }

    if (state) {
      queryConstraints.push(where("state", "==", state.toUpperCase()));
    }

    const q = query(
      collection(firestore, EVENTS_COLLECTION),
      ...queryConstraints.slice(0, 10)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.slice(0, resultLimit).map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  },

  async updateEvent(eventId, updates) {
    if (!auth.currentUser) throw new Error("Usuário não autenticado.");

    const event = await this.getEventById(eventId);
    if (event.createdBy !== auth.currentUser.uid) {
      throw new Error("Permissão negada. Apenas o criador pode editar.");
    }

    const normalized = normalizeEvent({ ...event, ...updates });
    const docRef = doc(firestore, EVENTS_COLLECTION, eventId);
    await updateDoc(docRef, { ...normalized, updatedAt: serverTimestamp() });

    return { id: eventId, ...normalized };
  },

  async deleteEvent(eventId) {
    if (!auth.currentUser) throw new Error("Usuário não autenticado.");

    const event = await this.getEventById(eventId);
    if (event.createdBy !== auth.currentUser.uid) {
      throw new Error("Permissão negada. Apenas o criador pode deletar.");
    }

    const docRef = doc(firestore, EVENTS_COLLECTION, eventId);
    await deleteDoc(docRef);
  },

  async rsvpEvent(eventId, carDetails = {}) {
    if (!auth.currentUser) throw new Error("Usuário não autenticado.");

    const participantData = {
      uid: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || "Anônimo",
      carDetails: {
        brand: String(carDetails.brand || "").trim(),
        model: String(carDetails.model || "").trim(),
        year: String(carDetails.year || "").trim(),
      },
      rsvpDate: serverTimestamp(),
    };

    const eventRef = doc(firestore, EVENTS_COLLECTION, eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) throw new Error("Evento não encontrado.");

    const eventData = eventSnap.data();
    const participants = eventData.participants || [];
    const alreadyRsvped = participants.some((p) => p.uid === auth.currentUser.uid);

    if (alreadyRsvped) {
      throw new Error("Você já confirmou presença neste evento.");
    }

    if (eventData.maxParticipants > 0 && participants.length >= eventData.maxParticipants) {
      throw new Error("Evento lotado. Desculpe!");
    }

    await updateDoc(eventRef, {
      participants: arrayUnion(participantData),
      participantCount: (eventData.participantCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });

    return participantData;
  },

  async cancelRsvp(eventId) {
    if (!auth.currentUser) throw new Error("Usuário não autenticado.");

    const eventRef = doc(firestore, EVENTS_COLLECTION, eventId);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) throw new Error("Evento não encontrado.");

    const eventData = eventSnap.data();
    const participants = eventData.participants || [];
    const filtered = participants.filter((p) => p.uid !== auth.currentUser.uid);

    if (filtered.length === participants.length) {
      throw new Error("Você não confirmou presença neste evento.");
    }

    await updateDoc(eventRef, {
      participants: filtered,
      participantCount: Math.max((eventData.participantCount || 0) - 1, 0),
      updatedAt: serverTimestamp(),
    });
  },

  async getEventParticipants(eventId) {
    const event = await this.getEventById(eventId);
    return event.participants || [];
  },

  async isUserRsvped(eventId) {
    if (!auth.currentUser) return false;

    try {
      const event = await this.getEventById(eventId);
      return (event.participants || []).some((p) => p.uid === auth.currentUser.uid);
    } catch {
      return false;
    }
  },
};
