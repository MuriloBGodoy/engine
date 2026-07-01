package com.engine.api.exception;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(ExternalServiceException.class)
  ResponseEntity<Map<String, Object>> externalService(ExternalServiceException error) {
    return error(HttpStatus.SERVICE_UNAVAILABLE, error.getMessage());
  }

  @ExceptionHandler({
    MethodArgumentNotValidException.class,
    HandlerMethodValidationException.class,
    IllegalArgumentException.class
  })
  ResponseEntity<Map<String, Object>> badRequest(Exception error) {
    return error(HttpStatus.BAD_REQUEST, error.getMessage());
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, Object>> unexpected(Exception error) {
    return error(HttpStatus.INTERNAL_SERVER_ERROR, error.getMessage());
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String, Object>> responseStatus(ResponseStatusException error) {
    return error(HttpStatus.valueOf(error.getStatusCode().value()), error.getReason());
  }

  private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
    return ResponseEntity.status(status)
        .body(
            Map.of(
                "status", status.value(),
                "error", status.getReasonPhrase(),
                "message", message,
                "time", Instant.now().toString()));
  }
}
