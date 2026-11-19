package com.ashport.game;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Asks GitHub for the latest release and installs its game if it is newer
 * than both the one packed in the app and the one already downloaded.
 * Plain Java with no Android in it, so it is tested without a phone.
 */
final class UpdateCheck {
    private static final int TIMEOUT_MS = 15000;
    private static final int MAX_REDIRECTS = 5;

    private UpdateCheck() {}

    /** What the check tells the screen while it works. Called from the thread that runs the check. */
    interface Progress {
        /** A newer game exists and its download begins. */
        void found(String version);
        /** So many bytes of the download have arrived, of so many (0 when the server did not say). */
        void downloaded(long done, long total);
        /** So many files of the game are in place, of so many. */
        void unpacked(int done, int total);
    }

    private static final Progress SILENT = new Progress() {
        @Override public void found(String version) {}
        @Override public void downloaded(long done, long total) {}
        @Override public void unpacked(int done, int total) {}
    };

    static String run(String latestReleaseUrl, File root, String bundledVersion) {
        return run(latestReleaseUrl, root, bundledVersion, SILENT, Long.MAX_VALUE / 4);
    }

    /**
     * Returns the version that was just installed, or null when there was
     * nothing to do or the check failed. A failed check is never an error for
     * the player: the game they have keeps working.
     * The whole check is given `allowedMs` and no more: past that it gives up,
     * so a bad network never keeps the player waiting.
     */
    static String run(String latestReleaseUrl, File root, String bundledVersion, Progress progress, long allowedMs) {
        final long deadline = System.currentTimeMillis() + allowedMs;
        try {
            GameBundle.Release latest;
            try (InputStream in = open(latestReleaseUrl, "application/vnd.github+json", deadline).body) {
                latest = GameBundle.readRelease(text(in));
            }
            if (latest == null) return null;
            String installed = GameBundle.installedVersion(root);
            if (!GameBundle.isNewer(latest.version, bundledVersion)) return null;
            if (installed != null && !GameBundle.isNewer(latest.version, installed)) return null;
            root.mkdirs();
            progress.found(latest.version);
            Answer file = open(latest.bundleUrl, "application/octet-stream", deadline);
            // The download goes to a file first, so that the number of files it
            // holds is known before the first one is put in place.
            File download = new File(root, "download.zip");
            try {
                try (InputStream in = new Counted(file.body, file.length, progress, deadline);
                     OutputStream out = new FileOutputStream(download)) {
                    byte[] buffer = new byte[16384];
                    for (int n = in.read(buffer); n > 0; n = in.read(buffer)) out.write(buffer, 0, n);
                }
                int count = 0;
                try (ZipFile zip = new ZipFile(download)) {
                    for (Enumeration<? extends ZipEntry> all = zip.entries(); all.hasMoreElements();) {
                        if (!all.nextElement().isDirectory()) count++;
                    }
                }
                final int total = count;
                try (InputStream in = new FileInputStream(download)) {
                    GameBundle.install(in, root, latest.version, done -> progress.unpacked(done, total));
                }
            } finally {
                download.delete();
            }
            return latest.version;
        } catch (IOException | RuntimeException failed) {
            return null;
        }
    }

    // Redirects are followed by hand: GitHub sends the download to another
    // host, and not every phone follows that on its own.
    private static Answer open(String address, String accept, long deadline) throws IOException {
        for (int hop = 0; hop < MAX_REDIRECTS; hop++) {
            int left = (int) Math.min(TIMEOUT_MS, deadline - System.currentTimeMillis());
            if (left <= 0) throw new IOException("out of time");
            HttpURLConnection c = (HttpURLConnection) new URL(address).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(left);
            c.setReadTimeout(left);
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
            return new Answer(c.getInputStream(), Math.max(0, c.getContentLengthLong()));
        }
        throw new IOException("too many redirects");
    }

    private static final class Answer {
        final InputStream body;
        final long length;

        Answer(InputStream body, long length) {
            this.body = body;
            this.length = length;
        }
    }

    /** Counts what goes through, tells the screen, and stops once the time allowed is spent. */
    private static final class Counted extends InputStream {
        private final InputStream in;
        private final long total;
        private final Progress progress;
        private final long deadline;
        private long done;

        Counted(InputStream in, long total, Progress progress, long deadline) {
            this.in = in;
            this.total = total;
            this.progress = progress;
            this.deadline = deadline;
        }

        @Override
        public int read() throws IOException {
            byte[] one = new byte[1];
            int n = read(one, 0, 1);
            return n < 0 ? -1 : one[0] & 0xFF;
        }

        @Override
        public int read(byte[] buffer, int from, int length) throws IOException {
            if (System.currentTimeMillis() > deadline) throw new IOException("out of time");
            int n = in.read(buffer, from, length);
            if (n > 0) {
                done += n;
                progress.downloaded(done, total);
            }
            return n;
        }

        @Override
        public void close() throws IOException {
            in.close();
        }
    }

    private static String text(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        for (int n = in.read(buffer); n > 0; n = in.read(buffer)) out.write(buffer, 0, n);
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
}
