package com.engine.api.service;

import com.engine.api.config.ApiProperties;
import com.engine.api.exception.ExternalServiceException;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Service
public class ImageService {

  private final ApiProperties.Pexels pexels;
  private final RestClient restClient;

  public ImageService(ApiProperties properties, RestClient.Builder restClientBuilder) {
    this.pexels = properties.pexels();
    this.restClient = restClientBuilder.baseUrl(pexels.baseUrl()).build();
  }

  public String findCarImage(String query) {
    if (!StringUtils.hasText(pexels.apiKey())) {
      throw new ExternalServiceException("PEXELS_API_KEY nao configurada.");
    }

    String optimizedQuery = "%s car high quality".formatted(query).toLowerCase();
    String imageUrl = search(optimizedQuery);
    return imageUrl != null ? imageUrl : search("car luxury dark");
  }

  private String search(String query) {
    Object response =
        restClient
            .get()
            .uri(uriBuilder -> uriBuilder.path("/search").queryParam("query", query).queryParam("per_page", 1).build())
            .header("Authorization", pexels.apiKey())
            .retrieve()
            .body(Object.class);

    if (!(response instanceof Map<?, ?> body)) {
      return null;
    }

    Object photos = body.get("photos");
    if (!(photos instanceof List<?> photoList) || photoList.isEmpty()) {
      return null;
    }

    Object first = photoList.getFirst();
    if (!(first instanceof Map<?, ?> photo)) {
      return null;
    }

    Object src = photo.get("src");
    if (!(src instanceof Map<?, ?> sources)) {
      return null;
    }

    Object large = sources.get("large");
    return large instanceof String url ? url : null;
  }
}
