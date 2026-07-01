package com.engine.api.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

  @Bean
  OpenAPI engineOpenApi() {
    return new OpenAPI()
        .components(
            new Components()
                .addSecuritySchemes(
                    "firebaseAuth",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("Firebase ID Token")))
        .addSecurityItem(new SecurityRequirement().addList("firebaseAuth"))
        .info(
            new Info()
                .title("Engine API")
                .description("Backend do Engine para FIPE, imagens e futuras regras de negocio.")
                .version("0.0.1")
                .contact(new Contact().name("Engine"))
                .license(new License().name("Private")))
        .servers(List.of(new Server().url("http://localhost:8080").description("Local")));
  }
}
