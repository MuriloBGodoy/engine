package com.engine.api.controller;

import com.engine.api.service.ImageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/images")
@Tag(name = "Images", description = "Busca imagens para carros usando provedores externos.")
public class ImageController {

  private final ImageService imageService;

  public ImageController(ImageService imageService) {
    this.imageService = imageService;
  }

  @GetMapping("/car")
  @Operation(summary = "Busca imagem de carro", description = "Retorna uma URL de imagem para a busca informada.")
  Map<String, String> getCarImage(
      @Parameter(description = "Busca do carro", example = "Ferrari F8")
      @RequestParam
      @NotBlank
      String query) {
    return Map.of("url", imageService.findCarImage(query));
  }
}
