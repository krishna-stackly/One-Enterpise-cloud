package com.stackly.pms.storage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;

@Service
public class LocalFileStorage implements FileStorage {
    private final Path root;

    public LocalFileStorage(@Value("${stackly.storage.local-path}") String rootPath) throws IOException {
        this.root = Path.of(rootPath).toAbsolutePath().normalize();
        Files.createDirectories(this.root);
    }

    @Override
    public StoredFile store(String originalName, String contentType, InputStream content, long size) throws IOException {
        String safeName = originalName == null ? "file" : originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        String key = UUID.randomUUID() + "-" + safeName;
        Files.copy(content, root.resolve(key));
        return new StoredFile(key, "/api/files/" + key, originalName == null ? safeName : originalName, contentType, size);
    }

    @Override
    public Resource load(String storageKey) throws IOException {
        Path resolved = root.resolve(storageKey).normalize();
        if (!resolved.startsWith(root) || !Files.exists(resolved) || !Files.isRegularFile(resolved)) {
            throw new IOException("File not found");
        }
        Resource resource = new UrlResource(resolved.toUri());
        if (!resource.exists() || !resource.isReadable()) {
            throw new IOException("File not readable");
        }
        return resource;
    }
}
