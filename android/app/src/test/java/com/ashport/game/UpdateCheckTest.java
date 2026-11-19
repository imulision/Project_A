package com.ashport.game;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

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
            answer(out, "200 OK", "", bundle);
        } else {
            answer(out, "404 Not Found", "", new byte[0]);
        }
    }

    private static void answer(OutputStream out, String status, String headers, byte[] body) throws IOException {
        out.write(("HTTP/1.1 " + status + "\r\n" + headers + "Content-Length: " + body.length + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
        out.write(body);
        out.flush();
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
}
