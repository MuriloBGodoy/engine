package com.engine.api.controller;

import com.engine.api.service.FipeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/fipe")
@Tag(name = "FIPE", description = "Consulta marcas, modelos, anos e precos pela tabela FIPE.")
public class FipeController {

  private final FipeService fipeService;

  public FipeController(FipeService fipeService) {
    this.fipeService = fipeService;
  }

  @GetMapping("/brands")
  @Operation(summary = "Lista marcas", description = "Retorna todas as marcas de carros disponiveis na FIPE.")
  Object getBrands() {
    return fipeService.getBrands();
  }

  @GetMapping("/brands/{brandId}/models")
  @Operation(summary = "Lista modelos", description = "Retorna os modelos de uma marca especifica.")
  Object getModels(
      @Parameter(description = "Codigo da marca na FIPE", example = "20")
      @PathVariable
      @NotBlank
      String brandId) {
    return fipeService.getModels(brandId);
  }

  @GetMapping("/brands/{brandId}/models/{modelId}/years")
  @Operation(summary = "Lista anos", description = "Retorna os anos disponiveis para um modelo.")
  Object getYears(
      @Parameter(description = "Codigo da marca na FIPE", example = "20")
      @PathVariable
      @NotBlank
      String brandId,
      @Parameter(description = "Codigo do modelo na FIPE", example = "4828")
      @PathVariable
      @NotBlank
      String modelId) {
    return fipeService.getYears(brandId, modelId);
  }

  @GetMapping("/brands/{brandId}/models/{modelId}/years/{yearId}/price")
  @Operation(summary = "Consulta preco", description = "Retorna o valor FIPE de uma versao especifica.")
  Object getPrice(
      @Parameter(description = "Codigo da marca na FIPE", example = "20")
      @PathVariable
      @NotBlank
      String brandId,
      @Parameter(description = "Codigo do modelo na FIPE", example = "4828")
      @PathVariable
      @NotBlank
      String modelId,
      @Parameter(description = "Codigo do ano/combustivel na FIPE", example = "2014-1")
      @PathVariable
      @NotBlank
      String yearId) {
    return fipeService.getPrice(brandId, modelId, yearId);
  }
}
