package com.stackly.pms.storage;

import java.io.IOException;
import java.io.InputStream;
import org.springframework.core.io.Resource;

public interface FileStorage {
    StoredFile store(String originalName, String contentType, InputStream content, long size) throws IOException;

    Resource load(String storageKey) throws IOException;

    record StoredFile(String key, String url, String fileName, String contentType, long size) {}
}
