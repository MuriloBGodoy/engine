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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@Tag(name = "Notifications", description = "Notificacoes privadas do usuario.")
public class NotificationsController {

  private final EngineFirestoreService engineFirestoreService;

  public NotificationsController(EngineFirestoreService engineFirestoreService) {
    this.engineFirestoreService = engineFirestoreService;
  }

  @GetMapping
  @Operation(summary = "Lista notificacoes")
  List<Map<String, Object>> getNotifications(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.getNotifications(user.uid());
  }

  @PatchMapping("/read")
  @Operation(summary = "Marca notificacoes como lidas")
  void markNotificationsRead(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    engineFirestoreService.markNotificationsRead(user.uid());
  }
}
