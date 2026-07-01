package com.engine.api.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "engine")
public record ApiProperties(Cors cors, Firebase firebase, Fipe fipe, Pexels pexels) {

  public record Cors(List<String> allowedOrigins) {}

  public record Firebase(String projectId) {}

  public record Fipe(String baseUrl) {}

  public record Pexels(String baseUrl, String apiKey) {}
}
