package com.engine.api.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ClubMembership {
  public String clubId;
  public String userId;
  public String role;
  public long joinedAt;
  public String status;
  public Map<String, Boolean> permissions;
  public Map<String, Object> userProfile;

  public ClubMembership() {}

  public ClubMembership(String clubId, String userId, String role, long joinedAt) {
    this.clubId = clubId;
    this.userId = userId;
    this.role = role;
    this.joinedAt = joinedAt;
    this.status = "active";
  }

  public boolean isOwner() {
    return "owner".equals(role);
  }

  public boolean isModerator() {
    return "moderator".equals(role) || isOwner();
  }

  public boolean canPost() {
    return permissions != null && permissions.getOrDefault("canPost", true);
  }

  public boolean canComment() {
    return permissions != null && permissions.getOrDefault("canComment", true);
  }

  public boolean canModerate() {
    return permissions != null && permissions.getOrDefault("canModerate", false);
  }
}
