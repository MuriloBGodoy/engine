package com.engine.api.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ClubPost {
  public String id;
  public String clubId;
  public String authorId;
  public String authorName;
  public String authorAvatar;
  public String content;
  public List<String> imageUrls;
  public int likes;
  public int commentCount;
  public long createdAt;
  public long editedAt;
  public String status;
  public List<String> tags;

  public ClubPost() {}

  public ClubPost(
      String id,
      String clubId,
      String authorId,
      String authorName,
      String content,
      long createdAt) {
    this.id = id;
    this.clubId = clubId;
    this.authorId = authorId;
    this.authorName = authorName;
    this.content = content;
    this.createdAt = createdAt;
    this.status = "published";
    this.likes = 0;
    this.commentCount = 0;
  }
}
