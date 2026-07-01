package com.engine.api.controller;

import com.engine.api.security.AuthContext;
import com.engine.api.security.AuthenticatedUser;
import com.engine.api.service.EngineFirestoreService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cars")
@Tag(name = "Cars", description = "Garagem privada do usuario autenticado.")
public class CarsController {

  private final EngineFirestoreService engineFirestoreService;

  public CarsController(EngineFirestoreService engineFirestoreService) {
    this.engineFirestoreService = engineFirestoreService;
  }

  @GetMapping
  @Operation(summary = "Lista carros")
  List<Map<String, Object>> getCars(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.getCars(user.uid());
  }

  @PostMapping
  @Operation(summary = "Cria ou atualiza carro")
  Map<String, Object> saveCar(HttpServletRequest request, @RequestBody Map<String, Object> car)
      throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    return engineFirestoreService.saveCar(user.uid(), car);
  }

  @DeleteMapping("/{carId}")
  @Operation(summary = "Remove carro")
  void deleteCar(HttpServletRequest request, @PathVariable String carId) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    engineFirestoreService.deleteCar(user.uid(), carId);
  }

  @DeleteMapping
  @Operation(summary = "Limpa garagem")
  void resetCars(HttpServletRequest request) throws Exception {
    AuthenticatedUser user = AuthContext.requireUser(request);
    engineFirestoreService.resetCars(user.uid());
  }
}
