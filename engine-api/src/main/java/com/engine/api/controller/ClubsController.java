package com.engine.api.controller;

import com.engine.api.model.Club;
import com.engine.api.model.ClubMembership;
import com.engine.api.model.ClubPost;
import com.engine.api.security.AuthContext;
import com.engine.api.security.AuthenticatedUser;
import com.engine.api.service.ClubsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/clubs")
@Tag(name = "Clubs", description = "Clubes, posts, membros e interacoes")
public class ClubsController {

  private final ClubsService clubsService;

  public ClubsController(ClubsService clubsService) {
    this.clubsService = clubsService;
  }

  // ===================== CLUBS CRUD =====================

  @PostMapping
  @Operation(summary = "Criar novo clube")
  Club createClub(HttpServletRequest request, @RequestBody Map<String, Object> body)
      throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return clubsService.createClub(
        user.uid(),
        String.valueOf(body.get("name")),
        String.valueOf(body.getOrDefault("description", "")),
        String.valueOf(body.getOrDefault("imageUrl", "")),
        String.valueOf(body.getOrDefault("category", "Other")),
        (List<String>) body.getOrDefault("tags", List.of()),
        Boolean.TRUE.equals(body.get("isPublic")));
  }

  @GetMapping
  @Operation(summary = "Listar meus clubes")
  List<Club> getMyClubs(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return clubsService.getMyClubs(user.uid());
  }

  @GetMapping("/discover")
  @Operation(summary = "Descobrir clubes públicos")
  List<Club> discoverClubs(
      @RequestParam(required = false) String search,
      @RequestParam(required = false) String category,
      @RequestParam(defaultValue = "20") int limit) throws Exception {
    return clubsService.discoverClubs(search, category, limit);
  }

  @GetMapping("/{clubId}")
  @Operation(summary = "Detalhe do clube")
  Club getClub(@PathVariable String clubId) throws Exception {
    return clubsService.getClub(clubId);
  }

  @PutMapping("/{clubId}")
  @Operation(summary = "Editar clube (owner)")
  Club updateClub(HttpServletRequest request, @PathVariable String clubId,
      @RequestBody Map<String, Object> updates) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return clubsService.updateClub(clubId, user.uid(), updates);
  }

  @DeleteMapping("/{clubId}")
  @Operation(summary = "Deletar clube (owner)")
  void deleteClub(HttpServletRequest request, @PathVariable String clubId) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    clubsService.deleteClub(clubId, user.uid());
  }

  // ===================== MEMBERSHIP =====================

  @PostMapping("/{clubId}/join")
  @Operation(summary = "Entrar no clube")
  ClubMembership joinClub(HttpServletRequest request, @PathVariable String clubId)
      throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return clubsService.joinClub(clubId, user.uid());
  }

  @DeleteMapping("/{clubId}/leave")
  @Operation(summary = "Sair do clube")
  void leaveClub(HttpServletRequest request, @PathVariable String clubId) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    clubsService.leaveClub(clubId, user.uid());
  }

  @GetMapping("/{clubId}/members")
  @Operation(summary = "Listar membros do clube")
  List<ClubMembership> getClubMembers(@PathVariable String clubId,
      @RequestParam(defaultValue = "50") int limit) throws Exception {
    return clubsService.getClubMembers(clubId, limit);
  }

  // ===================== POSTS =====================

  @PostMapping("/{clubId}/posts")
  @Operation(summary = "Criar post no clube")
  ClubPost createPost(HttpServletRequest request, @PathVariable String clubId,
      @RequestBody Map<String, Object> body) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return clubsService.createPost(
        clubId,
        user.uid(),
        String.valueOf(body.getOrDefault("authorName", user.uid())),
        String.valueOf(body.get("content")),
        (List<String>) body.getOrDefault("imageUrls", List.of()));
  }

  @GetMapping("/{clubId}/posts")
  @Operation(summary = "Feed de posts do clube")
  List<ClubPost> getClubPosts(@PathVariable String clubId,
      @RequestParam(defaultValue = "20") int limit) throws Exception {
    return clubsService.getClubPosts(clubId, limit);
  }

  @DeleteMapping("/{clubId}/posts/{postId}")
  @Operation(summary = "Deletar post (author/mod)")
  void deletePost(HttpServletRequest request, @PathVariable String clubId,
      @PathVariable String postId) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    clubsService.deletePost(clubId, postId, user.uid());
  }

  // ===================== LIKES =====================

  @PostMapping("/{clubId}/posts/{postId}/like")
  @Operation(summary = "Dar like em post")
  void likePost(HttpServletRequest request, @PathVariable String clubId,
      @PathVariable String postId) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    clubsService.likePost(clubId, postId, user.uid());
  }

  @DeleteMapping("/{clubId}/posts/{postId}/like")
  @Operation(summary = "Remover like de post")
  void unlikePost(HttpServletRequest request, @PathVariable String clubId,
      @PathVariable String postId) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    clubsService.unlikePost(clubId, postId, user.uid());
  }
}
