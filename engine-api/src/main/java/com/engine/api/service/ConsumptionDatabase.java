package com.engine.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class ConsumptionDatabase {

  private static final Logger log = LoggerFactory.getLogger(ConsumptionDatabase.class);
  private final Map<String, Map<String, Double>> models = new HashMap<>();
  private final Map<String, Double> defaultConsumption = new HashMap<>();

  public ConsumptionDatabase(ObjectMapper objectMapper) {
    loadDatabase(objectMapper);
  }

  private void loadDatabase(ObjectMapper objectMapper) {
    try {
      ClassPathResource resource = new ClassPathResource("fipe-consumption-db.json");
      try (InputStream input = resource.getInputStream()) {
        JsonNode root = objectMapper.readTree(input);

        // Carrega modelos
        JsonNode modelsNode = root.get("models");
        if (modelsNode != null && modelsNode.isObject()) {
          modelsNode.fields().forEachRemaining(entry -> {
            String model = entry.getKey();
            JsonNode consumption = entry.getValue();
            Map<String, Double> fuelConsumption = new HashMap<>();

            if (consumption.has("gasoline")) {
              fuelConsumption.put("gasoline", consumption.get("gasoline").asDouble());
            }
            if (consumption.has("ethanol")) {
              fuelConsumption.put("ethanol", consumption.get("ethanol").asDouble());
            }
            if (consumption.has("diesel")) {
              fuelConsumption.put("diesel", consumption.get("diesel").asDouble());
            }

            models.put(model, fuelConsumption);
          });
        }

        // Carrega default
        JsonNode defaultNode = root.get("default");
        if (defaultNode != null) {
          if (defaultNode.has("gasoline")) {
            defaultConsumption.put("gasoline", defaultNode.get("gasoline").asDouble());
          }
          if (defaultNode.has("ethanol")) {
            defaultConsumption.put("ethanol", defaultNode.get("ethanol").asDouble());
          }
          if (defaultNode.has("diesel")) {
            defaultConsumption.put("diesel", defaultNode.get("diesel").asDouble());
          }
        }

        // Log
        JsonNode stats = root.get("stats");
        if (stats != null) {
          log.info("Consumption database loaded: {} models, coverage: {}",
              models.size(), stats.get("coverage"));
        }
      }
    } catch (Exception e) {
      log.error("Failed to load consumption database", e);
      // Fallback: empty database, will use defaults
    }
  }

  public Map<String, Double> getConsumption(String modelName) {
    if (modelName == null) return defaultConsumption;

    String normalized = modelName.toLowerCase().trim();

    // Busca exata
    if (models.containsKey(normalized)) {
      return models.get(normalized);
    }

    // Busca por substring (primeira palavra)
    String firstWord = normalized.split("\\s+")[0];
    if (models.containsKey(firstWord)) {
      return models.get(firstWord);
    }

    // Fallback
    return defaultConsumption;
  }
}
