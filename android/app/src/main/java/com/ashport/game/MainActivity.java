package com.ashport.game;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.util.Locale;

/**
 * Shows the game page. All game code lives in web/. The page comes from the
 * latest download if there is one, otherwise from the copy packed in the app.
 *
 * A launch opens on the app's own screen (assets/shell/updating.html) while it
 * looks for a newer release and downloads it, with a bar, what is left to
 * download and the count of files. That screen never lasts: the check is given
 * a fixed time, and past a second limit the game starts whatever happened.
 *
 * Coming back to the app after a while looks again, in the background: Android
 * keeps the app alive for days, and a player who only ever comes back to it
 * would never get a new version. That one waits for the next launch.
 */
public class MainActivity extends Activity {
    private static final String PACKED_PAGE = "file:///android_asset/" + GameBundle.PAGE;
    private static final String LATEST_RELEASE = "https://api.github.com/repos/" + BuildConfig.UPDATE_REPO + "/releases/latest";
    private static final String LAUNCH_SCREEN = "file:///android_asset/shell/updating.html";
    // The time the check and its download are given at launch.
    private static final long CHECK_MS = 20000;
    // Past this the game starts, even if the check never answered.
    private static final long START_ANYWAY_MS = 25000;
    // The launch screen stays at least this long, so that it does not flash by.
    private static final long SHOWN_AT_LEAST_MS = 1400;
    // Coming back to the app looks again, but not more often than this.
    private static final long LOOK_AGAIN_MS = 5 * 60 * 1000;

    private WebView view;
    private File downloads;
    private String packedVersion;
    private long lastLook;
    private boolean looking;
    private boolean launching;
    private boolean screenReady;
    private String pendingScript;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        downloads = new File(getFilesDir(), "game");
        packedVersion = "v" + BuildConfig.VERSION_NAME;
        view = new WebView(this);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        view.setBackgroundColor(0xFF0C1612);
        setContentView(view);
        view.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String url) {
                if (!LAUNCH_SCREEN.equals(url)) return;
                screenReady = true;
                if (pendingScript != null) v.evaluateJavascript(pendingScript, null);
                pendingScript = null;
            }
        });
        if (savedInstanceState == null) {
            launch();
        } else {
            // Never come back on the launch screen: nothing would move it on.
            if (view.restoreState(savedInstanceState) == null || LAUNCH_SCREEN.equals(view.getUrl())) view.loadUrl(pageToShow());
        }
    }

    private String pageToShow() {
        String downloaded = GameBundle.installedVersion(downloads);
        if (downloaded == null || !GameBundle.isNewer(downloaded, packedVersion)) return PACKED_PAGE;
        return "file://" + new File(GameBundle.installedFolder(downloads), GameBundle.PAGE).getAbsolutePath();
    }

    // --- the launch: the app's own screen, then the game ---

    private void launch() {
        final long started = SystemClock.elapsedRealtime();
        launching = true;
        looking = true;
        lastLook = started;
        view.loadUrl(LAUNCH_SCREEN);
        main.postDelayed(this::startGame, START_ANYWAY_MS);
        new Thread(() -> {
            UpdateCheck.run(LATEST_RELEASE, downloads, packedVersion, new UpdateCheck.Progress() {
                private String version = "";
                private long shown = -1;

                @Override
                public void found(String v) {
                    version = v;
                    say("Downloading " + v, "", 0);
                }

                @Override
                public void downloaded(long done, long total) {
                    // not for every packet: the screen is told about each 2% or so
                    if (total > 0 && done < total && (done - shown) * 50 < total) return;
                    shown = done;
                    String left = total > 0 ? size(total - done) + " left of " + size(total) : size(done) + " received";
                    say("Downloading " + version, left, total > 0 ? 0.9 * done / total : 0.45);
                }

                @Override
                public void unpacked(int done, int total) {
                    say("Installing " + version, "File " + done + " of " + total, 0.9 + 0.1 * done / Math.max(1, total));
                }
            }, CHECK_MS);
            long wait = SHOWN_AT_LEAST_MS - (SystemClock.elapsedRealtime() - started);
            main.postDelayed(() -> {
                looking = false;
                startGame();
            }, Math.max(0, wait));
        }, "update-check").start();
    }

    private void startGame() {
        if (!launching || isFinishing() || isDestroyed()) return;
        launching = false;
        main.removeCallbacksAndMessages(null);
        view.loadUrl(pageToShow());
    }

    /** Shows a step on the launch screen. Safe from any thread, and before the screen is ready. */
    private void say(String stage, String detail, double fraction) {
        final String script = String.format(Locale.US, "window.ashportShell&&window.ashportShell.show(%s,%s,%.3f)",
                quoted(stage), quoted(detail), fraction);
        main.post(() -> {
            if (!launching) return;
            if (screenReady) view.evaluateJavascript(script, null);
            else pendingScript = script;
        });
    }

    private static String quoted(String text) {
        return "'" + text.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    private static String size(long bytes) {
        if (bytes >= 1024 * 1024) return String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0));
        return Math.max(1, Math.round(bytes / 1024.0)) + " KB";
    }

    // --- coming back to the app: look again, quietly ---

    private void lookForUpdate() {
        final long now = SystemClock.elapsedRealtime();
        if (looking || launching || now - lastLook < LOOK_AGAIN_MS) return;
        looking = true;
        lastLook = now;
        new Thread(() -> {
            final String installed = UpdateCheck.run(LATEST_RELEASE, downloads, packedVersion);
            runOnUiThread(() -> {
                looking = false;
                if (installed == null || isFinishing() || isDestroyed()) return;
                Toast.makeText(this, "Ashport " + installed + " is ready. It starts the next time you open the game.", Toast.LENGTH_LONG).show();
            });
        }, "update-check").start();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        view.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        main.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    @Override
    protected void onPause() {
        view.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        view.onResume();
        lookForUpdate();
    }
}
