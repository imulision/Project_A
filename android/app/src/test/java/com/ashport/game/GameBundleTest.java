package com.ashport.game;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.Before;
import org.junit.Test;

/** How the app keeps and replaces the copy of the game it downloaded. */
public class GameBundleTest {
    private File root;

    @Before
    public void emptyFolder() throws IOException {
        root = Files.createTempDirectory("ashport").toFile();
    }

    private static InputStream zip(String... namesAndTexts) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream out = new ZipOutputStream(bytes)) {
            for (int i = 0; i < namesAndTexts.length; i += 2) {
                out.putNextEntry(new ZipEntry(namesAndTexts[i]));
                out.write(namesAndTexts[i + 1].getBytes(StandardCharsets.UTF_8));
                out.closeEntry();
            }
        }
        return new ByteArrayInputStream(bytes.toByteArray());
    }

    private static String read(File f) throws IOException {
        return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
    }

    @Test
    public void nothingIsInstalledAtFirst() {
        assertNull(GameBundle.installedVersion(root));
        assertNull(GameBundle.installedFolder(root));
    }

    @Test
    public void installingADownloadMakesItTheCurrentGame() throws IOException {
        GameBundle.install(zip("index.html", "<p>new</p>", "sim.js", "rules"), root, "v0.1.7");
        assertEquals("v0.1.7", GameBundle.installedVersion(root));
        File folder = GameBundle.installedFolder(root);
        assertEquals("<p>new</p>", read(new File(folder, "index.html")));
        assertEquals("rules", read(new File(folder, "sim.js")));
    }

    @Test
    public void aNewerDownloadReplacesTheOlderOne() throws IOException {
        GameBundle.install(zip("index.html", "old"), root, "v0.1.7");
        File old = GameBundle.installedFolder(root);
        GameBundle.install(zip("index.html", "new"), root, "v0.1.8");
        assertEquals("v0.1.8", GameBundle.installedVersion(root));
        assertEquals("new", read(new File(GameBundle.installedFolder(root), "index.html")));
        assertFalse("the old copy is cleaned up", old.exists());
    }

    @Test
    public void aDownloadWithoutTheGamePageIsRefusedAndThePreviousGameStays() throws IOException {
        GameBundle.install(zip("index.html", "good"), root, "v0.1.7");
        try {
            GameBundle.install(zip("readme.txt", "not a game"), root, "v0.1.8");
            fail("a bundle without index.html must be refused");
        } catch (IOException expected) {
            // refused
        }
        assertEquals("v0.1.7", GameBundle.installedVersion(root));
        assertEquals("good", read(new File(GameBundle.installedFolder(root), "index.html")));
    }

    @Test
    public void aBrokenDownloadIsRefusedAndThePreviousGameStays() throws IOException {
        GameBundle.install(zip("index.html", "good"), root, "v0.1.7");
        try {
            GameBundle.install(new ByteArrayInputStream("this is not a zip".getBytes(StandardCharsets.UTF_8)), root, "v0.1.8");
            fail("a file that is not a zip must be refused");
        } catch (IOException expected) {
            // refused
        }
        assertEquals("v0.1.7", GameBundle.installedVersion(root));
    }

    @Test
    public void aDownloadCannotWriteOutsideItsOwnFolder() throws IOException {
        try {
            GameBundle.install(zip("index.html", "x", "../../escaped.txt", "bad"), root, "v0.1.8");
            fail("an entry that points outside the folder must be refused");
        } catch (IOException expected) {
            // refused
        }
        assertFalse(new File(root.getParentFile(), "escaped.txt").exists());
        assertNull(GameBundle.installedVersion(root));
    }

    @Test
    public void versionsCompareByNumberNotByText() {
        assertTrue(GameBundle.isNewer("v0.1.10", "v0.1.9"));
        assertTrue(GameBundle.isNewer("v0.2.0", "v0.1.99"));
        assertFalse(GameBundle.isNewer("v0.1.9", "v0.1.9"));
        assertFalse(GameBundle.isNewer("v0.1.8", "v0.1.9"));
        assertTrue("with or without the leading v", GameBundle.isNewer("v0.1.10", "0.1.9"));
    }

    @Test
    public void anUnreadableVersionIsNeverNewer() {
        assertFalse(GameBundle.isNewer("nightly", "v0.1.9"));
        assertFalse(GameBundle.isNewer(null, "v0.1.9"));
        assertTrue("anything readable beats nothing", GameBundle.isNewer("v0.1.1", null));
    }

    // What GitHub answers for the latest release, cut down to the fields used.
    private static final String RELEASE = "{\"url\":\"https://api.github.com/repos/o/r/releases/1\","
            + "\"tag_name\":\"v0.1.12\",\"assets\":["
            + "{\"url\":\"https://api.github.com/repos/o/r/releases/assets/501\",\"id\":501,\"node_id\":\"a\","
            + "\"name\":\"ashport.apk\",\"uploader\":{\"login\":\"bot\",\"url\":\"https://api.github.com/users/bot\"},\"size\":9},"
            + "{\"url\":\"https://api.github.com/repos/o/r/releases/assets/502\",\"id\":502,\"node_id\":\"b\","
            + "\"name\":\"web.zip\",\"uploader\":{\"login\":\"bot\",\"url\":\"https://api.github.com/users/bot\"},\"size\":7}]}";

    @Test
    public void theLatestReleaseGivesItsVersionAndWhereTheGameIs() {
        GameBundle.Release r = GameBundle.readRelease(RELEASE);
        assertEquals("v0.1.12", r.version);
        assertEquals("https://api.github.com/repos/o/r/releases/assets/502", r.bundleUrl);
    }

    @Test
    public void aReleaseWithoutAGameBundleIsIgnored() {
        assertNull(GameBundle.readRelease(RELEASE.replace("web.zip", "notes.txt")));
        assertNull(GameBundle.readRelease("{\"message\":\"Not Found\"}"));
        assertNull(GameBundle.readRelease(""));
    }

    @Test
    public void installingTellsEachFileAsItIsWritten() throws IOException {
        java.util.List<Integer> seen = new java.util.ArrayList<>();
        GameBundle.install(zip("index.html", "a", "sim.js", "b", "art/map.png", "c"), root, "v0.1.4", seen::add);
        assertEquals(java.util.Arrays.asList(1, 2, 3), seen);
    }
}
