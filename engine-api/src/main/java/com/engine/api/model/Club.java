package com.engine.api.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class Club {
  public String id;
  public String name;
  public String description;
  public String imageUrl;
  public String category;
  public List<String> tags;
  public boolean isPublic;
  public String createdBy;
  public long createdAt;
  public long updatedAt;
  public int memberCount;
  public int postCount;
  public Map<String, Object> settings;

  public Club() {}

  public Club(
      String id,
      String name,
      String description,
      String imageUrl,
      String category,
      List<String> tags,
      boolean isPublic,
      String createdBy,
      long createdAt) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.imageUrl = imageUrl;
    this.category = category;
    this.tags = tags;
    this.isPublic = isPublic;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = createdAt;
    this.memberCount = 1;
    this.postCount = 0;
  }
}
