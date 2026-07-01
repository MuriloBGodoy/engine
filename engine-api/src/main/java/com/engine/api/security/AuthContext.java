package com.engine.api.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class AuthContext {

  public static final String REQUEST_ATTRIBUTE = "engine.authenticatedUser";

  private AuthContext() {}

  public static AuthenticatedUser requireUser(HttpServletRequest request) {
    Object user = request.getAttribute(REQUEST_ATTRIBUTE);
    if (user instanceof AuthenticatedUser authenticatedUser) {
      return authenticatedUser;
    }

    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario nao autenticado.");
  }
}
