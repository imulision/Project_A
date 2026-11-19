package com.ashport.game;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * The copy of the game that the app downloaded, kept in one folder of the
 * phone. Plain Java with no Android in it, so it is tested without a phone.
 *
 * Layout of the folder: one sub-folder per version, and a small file that
 * names the version in use. That file is written last, so a download that
 * fails half way leaves the previous game untouched.
 */
final class GameBundle {
    static final String PAGE = "index.html";
    static final String BUNDLE_NAME = "web.zip";
    private static final String CURRENT = "current.txt";

    private GameBundle() {}

    /** The latest release as GitHub describes it. */
    static final class Release {
        final String version;
        final String bundleUrl;

        Release(String version, String bundleUrl) {
            this.version = version;
            this.bundleUrl = bundleUrl;
        }
    }

    private static final Pattern TAG = Pattern.compile("\"tag_name\"\\s*:\\s*\"([^\"]+)\"");
    // The address of an asset comes before its name, with nothing nested between.
    private static final Pattern ASSET = Pattern.compile(
            "\"url\"\\s*:\\s*\"([^\"]+/releases/assets/\\d+)\"[^{}]*?\"name\"\\s*:\\s*\"([^\"]+)\"");

    /** Reads GitHub's answer. Returns null when it holds no game to download. */
    static Release readRelease(String json) {
        if (json == null) return null;
        Matcher tag = TAG.matcher(json);
        if (!tag.find()) return null;
        Matcher asset = ASSET.matcher(json);
        while (asset.find()) {
            if (BUNDLE_NAME.equals(asset.group(2))) return new Release(tag.group(1), asset.group(1));
        }
        return null;
    }

    /** True when version a is readable and comes after version b. */
    static boolean isNewer(String a, String b) {
        int[] x = numbers(a);
        if (x == null) return false;
        int[] y = numbers(b);
        if (y == null) return true;
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? x[i] : 0, q = i < y.length ? y[i] : 0;
            if (p != q) return p > q;
        }
        return false;
    }

    private static int[] numbers(String version) {
        if (version == null || !version.matches("v?\\d+(\\.\\d+)*")) return null;
        String[] parts = version.replaceFirst("^v", "").split("\\.");
        int[] out = new int[parts.length];
        try {
            for (int i = 0; i < parts.length; i++) out[i] = Integer.parseInt(parts[i]);
        } catch (NumberFormatException tooLong) {
            return null;
        }
        return out;
    }

    static String installedVersion(File root) {
        File marker = new File(root, CURRENT);
        if (!marker.isFile()) return null;
        try {
            String version = new String(Files.readAllBytes(marker.toPath()), StandardCharsets.UTF_8).trim();
            return new File(new File(root, version), PAGE).isFile() ? version : null;
        } catch (IOException unreadable) {
            return null;
        }
    }

    static File installedFolder(File root) {
        String version = installedVersion(root);
        return version == null ? null : new File(root, version);
    }

    /**
     * Unpacks a downloaded game and makes it the one in use. Throws, and
     * changes nothing, if the download is broken or is not a game.
     */
    static void install(InputStream zip, File root, String version) throws IOException {
        if (numbers(version) == null) throw new IOException("unreadable version: " + version);
        File incoming = new File(root, version + ".incoming");
        delete(incoming);
        try {
            unpack(zip, incoming);
            if (!new File(incoming, PAGE).isFile()) throw new IOException("no " + PAGE + " in the download");
            File target = new File(root, version);
            delete(target);
            if (!incoming.renameTo(target)) throw new IOException("could not put the download in place");
        } catch (IOException e) {
            delete(incoming);
            throw e;
        }
        try (OutputStream out = new FileOutputStream(new File(root, CURRENT))) {
            out.write(version.getBytes(StandardCharsets.UTF_8));
        }
        File[] others = root.listFiles();
        if (others != null) {
            for (File f : others) {
                if (f.isDirectory() && !f.getName().equals(version)) delete(f);
            }
        }
    }

    private static void unpack(InputStream zip, File folder) throws IOException {
        if (!folder.mkdirs()) throw new IOException("could not create " + folder);
        String inside = folder.getCanonicalPath() + File.separator;
        int files = 0;
        try (ZipInputStream in = new ZipInputStream(zip)) {
            byte[] buffer = new byte[16384];
            for (ZipEntry entry = in.getNextEntry(); entry != null; entry = in.getNextEntry()) {
                File out = new File(folder, entry.getName());
                if (!out.getCanonicalPath().startsWith(inside)) throw new IOException("entry outside the folder: " + entry.getName());
                if (entry.isDirectory()) {
                    out.mkdirs();
                    continue;
                }
                out.getParentFile().mkdirs();
                try (OutputStream to = new FileOutputStream(out)) {
                    for (int n = in.read(buffer); n > 0; n = in.read(buffer)) to.write(buffer, 0, n);
                }
                files++;
            }
        }
        if (files == 0) throw new IOException("the download is empty or is not a zip");
    }

    private static void delete(File f) {
        File[] children = f.listFiles();
        if (children != null) for (File c : children) delete(c);
        f.delete();
    }
}
