package com.engine.api.service;

import com.engine.api.config.ApiProperties;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class FipeService {

  private final String baseUrl;
  private final RestClient restClient;
  private final ConsumptionDatabase consumptionDb;

  public FipeService(
      ApiProperties properties,
      RestClient.Builder restClientBuilder,
      ConsumptionDatabase consumptionDb) {
    this.baseUrl = properties.fipe().baseUrl();
    this.restClient = restClientBuilder.build();
    this.consumptionDb = consumptionDb;
  }


  public Object getBrands() {
    return get(baseUrl);
  }

  public Object getModels(String brandId) {
    return get("%s/%s/modelos".formatted(baseUrl, brandId));
  }

  public Object getYears(String brandId, String modelId) {
    return get("%s/%s/modelos/%s/anos".formatted(baseUrl, brandId, modelId));
  }

  public Object getPrice(String brandId, String modelId, String yearId) {
    return get("%s/%s/modelos/%s/anos/%s".formatted(baseUrl, brandId, modelId, yearId));
  }

  // Retorna consumo real (km/l) para um modelo específico
  // Carregado de fipe-consumption-db.json compilado pela Fase 2
  public Map<String, Double> getConsumption(String modelName) {
    return consumptionDb.getConsumption(modelName);
  }

  private Object get(String url) {
    return restClient.get().uri(url).retrieve().body(Object.class);
  }
}
