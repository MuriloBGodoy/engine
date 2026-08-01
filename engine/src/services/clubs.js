import { useState, useCallback } from "react";
import { auth } from "./firebase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

async function getAuthToken() {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken(true);
}

async function clubsRequest(endpoint, options = {}) {
  const token = await getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

export const api = {
  clubs: {
    // Get user's clubs (memberships)
    async getMyClubs() {
      return clubsRequest("/clubs");
    },

    // Get public clubs for discovery (with search/filter)
    async discoverClubs(filters = {}) {
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.category) params.append("category", filters.category);
      if (filters.sort) params.append("sort", filters.sort);
      if (filters.limit) params.append("limit", filters.limit);
      if (filters.offset) params.append("offset", filters.offset);

      const queryString = params.toString();
      return clubsRequest(`/clubs/discover${queryString ? "?" + queryString : ""}`);
    },

    // Get club detail
    async getClubById(clubId) {
      return clubsRequest(`/clubs/${clubId}`);
    },

    // Create new club
    async createClub(clubData) {
      return clubsRequest("/clubs", {
        method: "POST",
        body: JSON.stringify(clubData),
      });
    },

    // Update club (owner only)
    async updateClub(clubId, updates) {
      return clubsRequest(`/clubs/${clubId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },

    // Delete club (owner only)
    async deleteClub(clubId) {
      return clubsRequest(`/clubs/${clubId}`, { method: "DELETE" });
    },

    // Join club
    async joinClub(clubId) {
      return clubsRequest(`/clubs/${clubId}/join`, { method: "POST" });
    },

    // Leave club
    async leaveClub(clubId) {
      return clubsRequest(`/clubs/${clubId}/leave`, { method: "DELETE" });
    },

    // Get club members
    async getClubMembers(clubId, limit = 50, offset = 0) {
      const params = new URLSearchParams();
      params.append("limit", limit);
      params.append("offset", offset);
      return clubsRequest(`/clubs/${clubId}/members?${params.toString()}`);
    },

    // Posts
    async getClubPosts(clubId, limit = 20, offset = 0) {
      const params = new URLSearchParams();
      params.append("limit", limit);
      params.append("offset", offset);
      return clubsRequest(`/clubs/${clubId}/posts?${params.toString()}`);
    },

    async createPost(clubId, postData) {
      return clubsRequest(`/clubs/${clubId}/posts`, {
        method: "POST",
        body: JSON.stringify(postData),
      });
    },

    async updatePost(clubId, postId, updates) {
      return clubsRequest(`/clubs/${clubId}/posts/${postId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },

    async deletePost(clubId, postId) {
      return clubsRequest(`/clubs/${clubId}/posts/${postId}`, { method: "DELETE" });
    },

    // Likes
    async likePost(clubId, postId) {
      return clubsRequest(`/clubs/${clubId}/posts/${postId}/like`, { method: "POST" });
    },

    async unlikePost(clubId, postId) {
      return clubsRequest(`/clubs/${clubId}/posts/${postId}/like`, { method: "DELETE" });
    },
  },
};

// Custom hooks for easy use in components
export const useMyClubs = () => {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!auth.currentUser) {
      setClubs([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.clubs.getMyClubs();
      setClubs(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { clubs, loading, error, fetch };
};

export const useDiscoverClubs = () => {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.clubs.discoverClubs(filters);
      setClubs(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { clubs, loading, error, fetch };
};

export const useClubDetail = (clubId) => {
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isMember, setIsMember] = useState(false);

  const fetch = useCallback(async () => {
    if (!clubId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.clubs.getClubById(clubId);
      setClub(data);
      setIsMember(data?.isMember || false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  return { club, loading, error, isMember, fetch };
};

export const useClubMembers = (clubId) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const fetch = useCallback(async (limit = 50, offset = 0) => {
    if (!clubId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.clubs.getClubMembers(clubId, limit, offset);
      setMembers(data.members || []);
      setHasMore(data.hasMore || false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  return { members, loading, error, hasMore, fetch };
};

export const useClubPosts = (clubId) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const fetch = useCallback(async (limit = 20, offset = 0) => {
    if (!clubId) return;

    setLoading(true);
    setError(null);
    try {
      const data = await api.clubs.getClubPosts(clubId, limit, offset);
      if (offset === 0) {
        setPosts(data.posts || []);
      } else {
        setPosts((prev) => [...prev, ...(data.posts || [])]);
      }
      setHasMore(data.hasMore || false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  return { posts, loading, error, hasMore, fetch };
};

export const useCreateClub = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = useCallback(async (clubData) => {
    setLoading(true);
    setError(null);
    try {
      const club = await api.clubs.createClub(clubData);
      return club;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
};

export const useCreatePost = (clubId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = useCallback(
    async (postData) => {
      if (!clubId) throw new Error("Club ID required");

      setLoading(true);
      setError(null);
      try {
        const post = await api.clubs.createPost(clubId, postData);
        return post;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [clubId]
  );

  return { create, loading, error };
};

export const useTogglePostLike = (clubId, postId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = useCallback(
    async (isLiked) => {
      if (!clubId || !postId) throw new Error("Club ID and Post ID required");

      setLoading(true);
      setError(null);
      try {
        if (isLiked) {
          await api.clubs.unlikePost(clubId, postId);
        } else {
          await api.clubs.likePost(clubId, postId);
        }
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [clubId, postId]
  );

  return { toggle, loading, error };
};

export const useToggleClubMembership = (clubId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggle = useCallback(
    async (isMember) => {
      if (!clubId) throw new Error("Club ID required");

      setLoading(true);
      setError(null);
      try {
        if (isMember) {
          await api.clubs.leaveClub(clubId);
        } else {
          await api.clubs.joinClub(clubId);
        }
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [clubId]
  );

  return { toggle, loading, error };
};
