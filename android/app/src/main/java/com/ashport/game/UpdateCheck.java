package com.ashport.game;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Asks GitHub for the latest release and installs its game if it is newer
 * than both the one packed in the app and the one already downloaded.
 * Plain Java with no Android in it, so it is tested without a phone.
 */
final class UpdateCheck {
    private static final int TIMEOUT_MS = 15000;
    private static final int MAX_REDIRECTS = 5;

    private UpdateCheck() {}

    /**
     * Returns the version that was just installed, or null when there was
     * nothing to do or the check failed. A failed check is never an error for
     * the player: the game they have keeps working.
     */
    static String run(String latestReleaseUrl, File root, String bundledVersion) {
        try {
            GameBundle.Release latest;
            try (InputStream in = open(latestReleaseUrl, "application/vnd.github+json")) {
                latest = GameBundle.readRelease(text(in));
            }
            if (latest == null) return null;
            String installed = GameBundle.installedVersion(root);
            if (!GameBundle.isNewer(latest.version, bundledVersion)) return null;
            if (installed != null && !GameBundle.isNewer(latest.version, installed)) return null;
            root.mkdirs();
            try (InputStream in = open(latest.bundleUrl, "application/octet-stream")) {
                GameBundle.install(in, root, latest.version);
            }
            return latest.version;
        } catch (IOException | RuntimeException failed) {
            return null;
        }
    }

    // Redirects are followed by hand: GitHub sends the download to another
    // host, and not every phone follows that on its own.
    private static InputStream open(String address, String accept) throws IOException {
        for (int hop = 0; hop < MAX_REDIRECTS; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(TIMEOUT_MS);
            c.setReadTimeout(TIMEOUT_MS);
            c.setRequestProperty("Accept", accept);
            c.setRequestProperty("User-Agent", "Ashport-app");
            int status = c.getResponseCode();
            if (status >= 300 && status < 400 && c.getHeaderField("Location") != null) {
                address = new URL(new URL(address), c.getHeaderField("Location")).toString();
                c.disconnect();
                continue;
            }
            if (status != 200) {
                c.disconnect();
                throw new IOException("HTTP " + status + " from " + address);
            }
            return c.getInputStream();
        }
        throw new IOException("too many redirects");
    }

    private static String text(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        for (int n = in.read(buffer); n > 0; n = in.read(buffer)) out.write(buffer, 0, n);
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
}
