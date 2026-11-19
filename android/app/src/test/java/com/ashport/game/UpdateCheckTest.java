package com.ashport.game;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
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
    private HttpServer github;
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
        github = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        base = "http://127.0.0.1:" + github.getAddress().getPort();
        github.createContext("/repos/o/r/releases/latest", x -> {
            String json = "{\"tag_name\":\"" + latest + "\",\"assets\":[{\"url\":\"" + base
                    + "/repos/o/r/releases/assets/502\",\"id\":502,\"name\":\"web.zip\"}]}";
            answer(x, 200, json.getBytes(StandardCharsets.UTF_8));
        });
        // Like GitHub, the asset address only redirects to where the file is stored.
        github.createContext("/repos/o/r/releases/assets/502", x -> {
            downloadHeaders.add(String.valueOf(x.getRequestHeaders().getFirst("Accept")));
            x.getResponseHeaders().add("Location", base + "/storage/web.zip");
            answer(x, 302, new byte[0]);
        });
        github.createContext("/storage/web.zip", x -> {
            storageHeaders.add("seen");
            answer(x, 200, bundle);
        });
        github.start();
    }

    @After
    public void stopGithub() {
        github.stop(0);
    }

    private static void answer(HttpExchange x, int status, byte[] body) throws IOException {
        x.sendResponseHeaders(status, body.length == 0 ? -1 : body.length);
        if (body.length > 0) x.getResponseBody().write(body);
        x.close();
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
    public void noNetworkChangesNothingAndDoesNotCrash() {
        github.stop(0);
        assertNull(check("v0.1.3"));
        assertNull(GameBundle.installedVersion(root));
    }
}
