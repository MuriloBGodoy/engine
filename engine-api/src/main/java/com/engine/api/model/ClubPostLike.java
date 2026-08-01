package com.engine.api.model;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ClubPostLike {
  public String postId;
  public String userId;
  public long likedAt;

  public ClubPostLike() {}

  public ClubPostLike(String postId, String userId, long likedAt) {
    this.postId = postId;
    this.userId = userId;
    this.likedAt = likedAt;
  }
}
