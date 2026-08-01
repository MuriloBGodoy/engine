package com.engine.api.service;

import com.engine.api.model.Club;
import com.engine.api.model.ClubMembership;
import com.engine.api.model.ClubPost;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QuerySnapshot;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ClubsService {
  private final Firestore firestore;

  public ClubsService(Firestore firestore) {
    this.firestore = firestore;
  }

  // ===================== CLUBS CRUD =====================

  public Club createClub(String userId, String name, String description, String imageUrl,
      String category, List<String> tags, boolean isPublic) throws Exception {
    String clubId = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();

    Club club = new Club(clubId, name, description, imageUrl, category, tags, isPublic, userId, now);

    // Salva club
    firestore.collection("clubs").document(clubId).set(club).get();

    // Adiciona criador como owner
    ClubMembership ownership = new ClubMembership(clubId, userId, "owner", now);
    firestore.collection("clubMemberships").document(clubId).collection("members")
        .document(userId).set(ownership).get();

    return club;
  }

  public Club getClub(String clubId) throws Exception {
    DocumentSnapshot doc = firestore.collection("clubs").document(clubId).get().get();
    return doc.exists() ? doc.toObject(Club.class) : null;
  }

  public List<Club> getMyClubs(String userId) throws Exception {
    QuerySnapshot memberships = firestore.collection("clubMemberships")
        .whereArrayContains("memberIds", userId).get().get();

    List<Club> clubs = new ArrayList<>();
    for (var doc : memberships.getDocuments()) {
      String clubId = doc.getId();
      Club club = getClub(clubId);
      if (club != null) {
        clubs.add(club);
      }
    }
    return clubs;
  }

  public List<Club> discoverClubs(String search, String category, int limit) throws Exception {
    Query query = firestore.collection("clubs").whereEqualTo("isPublic", true).limit(limit);

    if (category != null && !category.isEmpty()) {
      query = query.whereEqualTo("category", category);
    }

    QuerySnapshot snapshot = query.get().get();
    List<Club> clubs = new ArrayList<>();
    for (var doc : snapshot.getDocuments()) {
      clubs.add(doc.toObject(Club.class));
    }

    // Filtro simples por search (Algolia pra produção)
    if (search != null && !search.isEmpty()) {
      String searchLower = search.toLowerCase();
      clubs.removeIf(c -> !c.name.toLowerCase().contains(searchLower));
    }

    return clubs;
  }

  public Club updateClub(String clubId, String userId, Map<String, Object> updates) throws Exception {
    // Verifica se é owner
    ClubMembership membership = getMembership(clubId, userId);
    if (membership == null || !membership.isOwner()) {
      throw new SecurityException("Apenas o owner pode editar o club");
    }

    updates.put("updatedAt", System.currentTimeMillis());
    firestore.collection("clubs").document(clubId).update(updates).get();
    return getClub(clubId);
  }

  public void deleteClub(String clubId, String userId) throws Exception {
    // Verifica se é owner
    ClubMembership membership = getMembership(clubId, userId);
    if (membership == null || !membership.isOwner()) {
      throw new SecurityException("Apenas o owner pode deletar o club");
    }

    firestore.collection("clubs").document(clubId).delete().get();
  }

  // ===================== MEMBERSHIP =====================

  public ClubMembership joinClub(String clubId, String userId) throws Exception {
    Club club = getClub(clubId);
    if (club == null) {
      throw new IllegalArgumentException("Club não encontrado");
    }

    long now = System.currentTimeMillis();
    ClubMembership membership = new ClubMembership(clubId, userId, "member", now);

    firestore.collection("clubMemberships").document(clubId).collection("members")
        .document(userId).set(membership).get();

    // Atualiza memberCount
    firestore.collection("clubs").document(clubId)
        .update("memberCount", club.memberCount + 1).get();

    return membership;
  }

  public void leaveClub(String clubId, String userId) throws Exception {
    ClubMembership membership = getMembership(clubId, userId);
    if (membership == null) {
      throw new IllegalArgumentException("Você não é membro deste club");
    }

    if (membership.isOwner()) {
      throw new SecurityException("Owner não pode deixar o club");
    }

    firestore.collection("clubMemberships").document(clubId).collection("members")
        .document(userId).delete().get();

    Club club = getClub(clubId);
    if (club != null) {
      firestore.collection("clubs").document(clubId)
          .update("memberCount", Math.max(0, club.memberCount - 1)).get();
    }
  }

  public ClubMembership getMembership(String clubId, String userId) throws Exception {
    DocumentSnapshot doc = firestore.collection("clubMemberships").document(clubId)
        .collection("members").document(userId).get().get();
    return doc.exists() ? doc.toObject(ClubMembership.class) : null;
  }

  public List<ClubMembership> getClubMembers(String clubId, int limit) throws Exception {
    QuerySnapshot snapshot = firestore.collection("clubMemberships").document(clubId)
        .collection("members").limit(limit).get().get();

    List<ClubMembership> members = new ArrayList<>();
    for (var doc : snapshot.getDocuments()) {
      members.add(doc.toObject(ClubMembership.class));
    }
    return members;
  }

  // ===================== POSTS =====================

  public ClubPost createPost(String clubId, String userId, String userName, String content,
      List<String> imageUrls) throws Exception {
    // Verifica se é membro
    ClubMembership membership = getMembership(clubId, userId);
    if (membership == null || !membership.canPost()) {
      throw new SecurityException("Você não tem permissão pra postar neste club");
    }

    String postId = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();

    ClubPost post = new ClubPost(postId, clubId, userId, userName, content, now);
    post.imageUrls = imageUrls;

    firestore.collection("clubPosts").document(clubId).collection("posts")
        .document(postId).set(post).get();

    // Atualiza postCount
    Club club = getClub(clubId);
    if (club != null) {
      firestore.collection("clubs").document(clubId)
          .update("postCount", club.postCount + 1).get();
    }

    return post;
  }

  public ClubPost getPost(String clubId, String postId) throws Exception {
    DocumentSnapshot doc = firestore.collection("clubPosts").document(clubId)
        .collection("posts").document(postId).get().get();
    return doc.exists() ? doc.toObject(ClubPost.class) : null;
  }

  public List<ClubPost> getClubPosts(String clubId, int limit) throws Exception {
    QuerySnapshot snapshot = firestore.collection("clubPosts").document(clubId)
        .collection("posts").orderBy("createdAt", Query.Direction.DESCENDING)
        .limit(limit).get().get();

    List<ClubPost> posts = new ArrayList<>();
    for (var doc : snapshot.getDocuments()) {
      posts.add(doc.toObject(ClubPost.class));
    }
    return posts;
  }

  public void deletePost(String clubId, String postId, String userId) throws Exception {
    ClubPost post = getPost(clubId, postId);
    if (post == null) {
      throw new IllegalArgumentException("Post não encontrado");
    }

    // Owner/author/mod pode deletar
    ClubMembership membership = getMembership(clubId, userId);
    if (!post.authorId.equals(userId) && !membership.canModerate()) {
      throw new SecurityException("Você não tem permissão pra deletar este post");
    }

    firestore.collection("clubPosts").document(clubId).collection("posts")
        .document(postId).delete().get();

    Club club = getClub(clubId);
    if (club != null) {
      firestore.collection("clubs").document(clubId)
          .update("postCount", Math.max(0, club.postCount - 1)).get();
    }
  }

  // ===================== LIKES =====================

  public void likePost(String clubId, String postId, String userId) throws Exception {
    ClubPost post = getPost(clubId, postId);
    if (post == null) {
      throw new IllegalArgumentException("Post não encontrado");
    }

    long now = System.currentTimeMillis();
    firestore.collection("clubPostLikes").document(clubId).collection("posts")
        .document(postId).collection("likes").document(userId)
        .set(new HashMap<>(Map.of("likedAt", now))).get();

    firestore.collection("clubPosts").document(clubId).collection("posts")
        .document(postId).update("likes", post.likes + 1).get();
  }

  public void unlikePost(String clubId, String postId, String userId) throws Exception {
    ClubPost post = getPost(clubId, postId);
    if (post == null) {
      throw new IllegalArgumentException("Post não encontrado");
    }

    firestore.collection("clubPostLikes").document(clubId).collection("posts")
        .document(postId).collection("likes").document(userId).delete().get();

    firestore.collection("clubPosts").document(clubId).collection("posts")
        .document(postId).update("likes", Math.max(0, post.likes - 1)).get();
  }
}
