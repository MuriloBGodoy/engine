package com.engine.api.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class FirebaseAuthFilter extends OncePerRequestFilter {

  private static final List<String> PUBLIC_PREFIXES =
      List.of(
          "/api/health",
          "/api/fipe",
          "/swagger-ui",
          "/v3/api-docs",
          "/swagger-resources");

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getRequestURI();
    return PUBLIC_PREFIXES.stream().anyMatch(path::startsWith);
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    addCorsHeaders(request, response);

    if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
      filterChain.doFilter(request, response);
      return;
    }

    String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
    if (authorization == null || !authorization.startsWith("Bearer ")) {
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token ausente.");
      return;
    }

    try {
      FirebaseToken token = FirebaseAuth.getInstance().verifyIdToken(authorization.substring(7));
      request.setAttribute(
          AuthContext.REQUEST_ATTRIBUTE,
          new AuthenticatedUser(token.getUid(), token.getEmail(), token.getName()));
      filterChain.doFilter(request, response);
    } catch (FirebaseAuthException error) {
      System.err.println("Firebase validation error: " + error.getMessage());
      error.printStackTrace();
      response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token invalido: " + error.getMessage());
    }
  }

  private void addCorsHeaders(HttpServletRequest request, HttpServletResponse response) {
    String origin = request.getHeader("Origin");
    if (origin != null && (origin.equals("http://localhost:5173") || origin.equals("http://127.0.0.1:5173"))) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "*");
      response.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }
}
