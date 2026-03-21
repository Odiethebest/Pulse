package com.odieyang.pulse.model;

import java.util.List;

public record RawPosts(
        String platform,
        List<RawPost> posts
) {}
