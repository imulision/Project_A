package com.ashport.game;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/** The whole check, against a small stand-in for GitHub on this machine. */
public class UpdateCheckTest {
    private ServerSocket github;
    private String base;
    private File root;
    private String latest = "v0.1.12";
    private byte[] bundle;
    private final List<String> downloadHeaders = new ArrayList<>();
    private final List<String> storageHeaders = new ArrayList<>();
    private long trickleMs; // when set, the stored file is sent a few bytes at a time, this far apart

    @Before
    public void startGithub() throws IOException {
        root = Files.createTempDirectory("ashport").toFile();
        bundle = zip("index.html", "<p>from github</p>");
        github = new ServerSocket(0, 10, InetAddress.getByName("127.0.0.1"));
        base = "http://127.0.0.1:" + github.getLocalPort();
        Thread serving = new Thread(() -> {
            while (!github.isClosed()) {
                try (Socket s = github.accept()) {
                    serve(s);
                } catch (IOException closedOrBroken) {
                    // the test is over, or the client went away
                }
            }
        });
        serving.setDaemon(true);
        serving.start();
    }

    @After
    public void stopGithub() throws IOException {
        github.close();
    }

    // One request per connection, which is all the check needs.
    private void serve(Socket s) throws IOException {
        BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.ISO_8859_1));
        String request = in.readLine();
        if (request == null) return;
        String path = request.split(" ")[1];
        String accept = "";
        for (String line = in.readLine(); line != null && !line.isEmpty(); line = in.readLine()) {
            if (line.toLowerCase().startsWith("accept:")) accept = line.substring(7).trim();
        }
        OutputStream out = s.getOutputStream();
        if (path.equals("/repos/o/r/releases/latest")) {
            String json = "{\"tag_name\":\"" + latest + "\",\"assets\":[{\"url\":\"" + base
                    + "/repos/o/r/releases/assets/502\",\"id\":502,\"name\":\"web.zip\"}]}";
            answer(out, "200 OK", "", json.getBytes(StandardCharsets.UTF_8));
        } else if (path.equals("/repos/o/r/releases/assets/502")) {
            // Like GitHub, the asset address only redirects to where the file is stored.
            downloadHeaders.add(accept);
            answer(out, "302 Found", "Location: " + base + "/storage/web.zip\r\n", new byte[0]);
        } else if (path.equals("/storage/web.zip")) {
            storageHeaders.add("seen");
            if (trickleMs > 0) trickle(out, bundle);
            else answer(out, "200 OK", "", bundle);
        } else {
            answer(out, "404 Not Found", "", new byte[0]);
        }
    }

    private static void answer(OutputStream out, String status, String headers, byte[] body) throws IOException {
        out.write(("HTTP/1.1 " + status + "\r\n" + headers + "Content-Length: " + body.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
        out.write(body);
        out.flush();
    }

    private void trickle(OutputStream out, byte[] body) throws IOException {
        out.write(("HTTP/1.1 200 OK\r\nContent-Length: " + body.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
        for (int i = 0; i < body.length; i += 4) {
            out.write(body, i, Math.min(4, body.length - i));
            out.flush();
            try { Thread.sleep(trickleMs); } catch (InterruptedException stop) { return; }
        }
    }

    /** Remembers what the check said while it worked. */
    private static final class Seen implements UpdateCheck.Progress {
        final List<String> found = new ArrayList<>();
        final List<long[]> steps = new ArrayList<>();
        @Override public void found(String version) { found.add(version); }
        final List<int[]> files = new ArrayList<>();
        @Override public void downloaded(long done, long total) { steps.add(new long[] {done, total}); }
        @Override public void unpacked(int done, int total) { files.add(new int[] {done, total}); }
    }

    private static byte[] zip(String name, String text) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream out = new ZipOutputStream(bytes)) {
            out.putNextEntry(new ZipEntry(name));
            out.write(text.getBytes(StandardCharsets.UTF_8));
            out.closeEntry();
        }
        return bytes.toByteArray();
    }

    private String check(String bundled) {
        return UpdateCheck.run(base + "/repos/o/r/releases/latest", root, bundled);
    }

    @Test
    public void aNewerReleaseIsDownloadedAndInstalled() throws IOException {
        assertEquals("v0.1.12", check("v0.1.3"));
        assertEquals("v0.1.12", GameBundle.installedVersion(root));
        File page = new File(GameBundle.installedFolder(root), "index.html");
        assertEquals("<p>from github</p>", new String(Files.readAllBytes(page.toPath()), StandardCharsets.UTF_8));
        assertEquals("the file itself is asked for, not its description", "application/octet-stream", downloadHeaders.get(0));
    }

    @Test
    public void nothingIsDownloadedWhenTheAppAlreadyShipsThatVersion() {
        assertNull(check("v0.1.12"));
        assertNull(GameBundle.installedVersion(root));
        assertEquals(0, storageHeaders.size());
    }

    @Test
    public void nothingIsDownloadedTwice() {
        check("v0.1.3");
        assertNull(check("v0.1.3"));
        assertEquals(1, storageHeaders.size());
    }

    @Test
    public void aLaterReleaseReplacesADownloadedOne() {
        check("v0.1.3");
        latest = "v0.1.13";
        assertEquals("v0.1.13", check("v0.1.3"));
        assertEquals("v0.1.13", GameBundle.installedVersion(root));
    }

    @Test
    public void aBrokenDownloadChangesNothingAndDoesNotCrash() {
        check("v0.1.3");
        latest = "v0.1.13";
        bundle = "not a zip".getBytes(StandardCharsets.UTF_8);
        assertNull(check("v0.1.3"));
        assertEquals("v0.1.12", GameBundle.installedVersion(root));
    }

    @Test
    public void noNetworkChangesNothingAndDoesNotCrash() throws IOException {
        github.close();
        assertNull(check("v0.1.3"));
        assertNull(GameBundle.installedVersion(root));
    }

    @Test
    public void theCheckSaysWhatItFoundAndHowFarTheDownloadIs() {
        Seen seen = new Seen();
        assertEquals("v0.1.12", UpdateCheck.run(base + "/repos/o/r/releases/latest", root, "v0.1.3", seen, 10000));
        assertEquals(1, seen.found.size());
        assertEquals("v0.1.12", seen.found.get(0));
        assertTrue("at least one step", seen.steps.size() >= 1);
        long before = 0;
        for (long[] step : seen.steps) {
            assertTrue("never goes back", step[0] >= before);
            assertEquals("the size announced by the server", bundle.length, step[1]);
            before = step[0];
        }
        assertEquals("ends with the whole file", bundle.length, before);
    }

    @Test
    public void nothingIsSaidWhenThereIsNothingNew() {
        Seen seen = new Seen();
        assertNull(UpdateCheck.run(base + "/repos/o/r/releases/latest", root, "v0.1.12", seen, 10000));
        assertEquals(0, seen.found.size());
        assertEquals(0, seen.steps.size());
    }

    @Test
    public void aDownloadThatDragsOnIsGivenUpAndThePlayerKeepsTheGameHeHas() {
        trickleMs = 100; // the whole file would take many seconds
        long started = System.currentTimeMillis();
        assertNull(UpdateCheck.run(base + "/repos/o/r/releases/latest", root, "v0.1.3", new Seen(), 500));
        assertTrue("gave up soon after the time allowed", System.currentTimeMillis() - started < 3000);
        assertNull(GameBundle.installedVersion(root));
    }

    @Test
    public void theCheckCountsTheFilesOfTheGameAsItPutsThemInPlace() throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream out = new ZipOutputStream(bytes)) {
            out.putNextEntry(new ZipEntry("art/")); // a folder is not a file
            out.closeEntry();
            for (String name : new String[] {"index.html", "game.js", "art/map.png"}) {
                out.putNextEntry(new ZipEntry(name));
                out.write(name.getBytes(StandardCharsets.UTF_8));
                out.closeEntry();
            }
        }
        bundle = bytes.toByteArray();
        Seen seen = new Seen();
        assertEquals("v0.1.12", UpdateCheck.run(base + "/repos/o/r/releases/latest", root, "v0.1.3", seen, 10000));
        assertEquals(3, seen.files.size());
        for (int i = 0; i < 3; i++) {
            assertEquals(i + 1, seen.files.get(i)[0]);
            assertEquals("the number of files is known before the first one", 3, seen.files.get(i)[1]);
        }
        String[] left = root.list();
        assertEquals("nothing but the game and its marker stays on the phone", 2, left == null ? -1 : left.length);
    }
}
