package com.engine.api.service;

import com.engine.api.config.ApiProperties;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class FipeService {

  private final String baseUrl;
  private final RestClient restClient;

  public FipeService(ApiProperties properties, RestClient.Builder restClientBuilder) {
    this.baseUrl = properties.fipe().baseUrl();
    this.restClient = restClientBuilder.build();
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

  private Object get(String url) {
    return restClient.get().uri(url).retrieve().body(Object.class);
  }
}
