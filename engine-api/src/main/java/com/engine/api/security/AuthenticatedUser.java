package com.engine.api.security;

public record AuthenticatedUser(String uid, String email, String name) {}
