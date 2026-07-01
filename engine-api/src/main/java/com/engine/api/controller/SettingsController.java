package com.engine.api.controller;

import com.engine.api.security.AuthContext;
import com.engine.api.security.AuthenticatedUser;
import com.engine.api.service.EngineFirestoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
@Tag(name = "Settings", description = "Perfil, preferencias e privacidade do usuario.")
public class SettingsController {

  private final EngineFirestoreService engineFirestoreService;

  public SettingsController(EngineFirestoreService engineFirestoreService) {
    this.engineFirestoreService = engineFirestoreService;
  }

  @GetMapping
  @Operation(summary = "Busca configuracoes")
  Map<String, Object> getSettings(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.getSettings(user.uid());
  }

  @PutMapping
  @Operation(summary = "Salva configuracoes")
  Map<String, Object> saveSettings(
      HttpServletRequest request, @RequestBody Map<String, Object> settings) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.saveSettings(user.uid(), settings);
  }

  @DeleteMapping
  @Operation(summary = "Restaura configuracoes")
  Map<String, Object> resetSettings(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.resetSettings(user.uid());
  }
}
