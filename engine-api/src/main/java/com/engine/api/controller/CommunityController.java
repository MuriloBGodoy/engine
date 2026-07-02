package com.engine.api.controller;

import com.engine.api.security.AuthContext;
import com.engine.api.security.AuthenticatedUser;
import com.engine.api.service.EngineFirestoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/community")
@Tag(name = "Community", description = "Metas compartilhadas, interacoes e estado social.")
public class CommunityController {

  private final EngineFirestoreService engineFirestoreService;

  public CommunityController(EngineFirestoreService engineFirestoreService) {
    this.engineFirestoreService = engineFirestoreService;
  }

  @GetMapping("/state")
  @Operation(summary = "Busca estado da comunidade")
  Map<String, Object> getCommunityState(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.getCommunityState(user.uid());
  }

  @PutMapping("/state")
  @Operation(summary = "Salva estado da comunidade")
  Map<String, Object> saveCommunityState(
      HttpServletRequest request, @RequestBody Map<String, Object> state) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.saveCommunityState(user.uid(), state);
  }

  @GetMapping("/goals")
  @Operation(summary = "Lista metas compartilhadas")
  List<Map<String, Object>> getCommunityGoals(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.getCommunityGoals(user.uid());
  }

  @GetMapping("/users/{userId}")
  @Operation(summary = "Busca perfil publico da comunidade")
  Map<String, Object> getPublicProfile(HttpServletRequest request, @PathVariable String userId)
      throws Exception {
    AuthenticatedUser viewer = AuthContext.requireUser(request);
    return engineFirestoreService.getPublicProfile(viewer.uid(), userId);
  }

  @PostMapping("/goals")
  @Operation(summary = "Compartilha meta")
  Map<String, Object> shareCommunityGoal(
      HttpServletRequest request, @RequestBody Map<String, Object> goal) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.shareCommunityGoal(user.uid(), goal);
  }

  @DeleteMapping("/goals/{goalId}")
  @Operation(summary = "Remove meta compartilhada")
  void deleteCommunityGoal(HttpServletRequest request, @PathVariable String goalId) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    engineFirestoreService.deleteCommunityGoal(user.uid(), goalId);
  }

  @DeleteMapping("/goals")
  @Operation(summary = "Remove todas as metas compartilhadas do usuario")
  void deleteMyCommunityGoals(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    engineFirestoreService.deleteMyCommunityGoals(user.uid());
  }

  @PatchMapping("/goals/{goalId}/like")
  @Operation(summary = "Curte ou remove curtida")
  void toggleCommunityLike(
      HttpServletRequest request, @PathVariable String goalId, @RequestBody Map<String, Object> body)
      throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    engineFirestoreService.toggleCommunityLike(user.uid(), goalId, Boolean.TRUE.equals(body.get("liked")));
  }

  @PostMapping("/goals/{goalId}/comments")
  @Operation(summary = "Adiciona comentario")
  void addCommunityComment(
      HttpServletRequest request, @PathVariable String goalId, @RequestBody Map<String, Object> body)
      throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    engineFirestoreService.addCommunityComment(user.uid(), goalId, String.valueOf(body.getOrDefault("comment", "")));
  }

  @PatchMapping("/goals/{goalId}/rating")
  @Operation(summary = "Avalia meta")
  void rateCommunityGoal(
      HttpServletRequest request, @PathVariable String goalId, @RequestBody Map<String, Object> body)
      throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    engineFirestoreService.rateCommunityGoal(
        user.uid(), goalId, Integer.parseInt(String.valueOf(body.getOrDefault("rating", 1))));
  }

  @PostMapping("/users/{userId}/follow")
  @Operation(summary = "Notifica usuario seguido")
  void notifyFollow(HttpServletRequest request, @PathVariable String userId) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    engineFirestoreService.notifyFollow(user.uid(), userId);
  }
}
