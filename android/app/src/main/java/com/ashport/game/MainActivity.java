package com.ashport.game;

import android.app.Activity;
import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import java.io.File;

/**
 * Shows the game page. All game code lives in web/. The page comes from the
 * latest download if there is one, otherwise from the copy packed in the app.
 * Each launch also looks for a newer release in the background.
 */
public class MainActivity extends Activity {
    private static final String PACKED_PAGE = "file:///android_asset/" + GameBundle.PAGE;
    private static final String LATEST_RELEASE = "https://api.github.com/repos/" + BuildConfig.UPDATE_REPO + "/releases/latest";
    // An update that arrives this soon after launch is shown at once. Later
    // than that the player is in a game, so it waits for the next launch.
    private static final long SWITCH_AT_ONCE_MS = 10000;

    private WebView view;
    private File downloads;
    private String packedVersion;

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
        if (savedInstanceState == null) {
            view.loadUrl(pageToShow());
            lookForUpdate();
        } else {
            view.restoreState(savedInstanceState);
        }
    }

    private String pageToShow() {
        String downloaded = GameBundle.installedVersion(downloads);
        if (downloaded == null || !GameBundle.isNewer(downloaded, packedVersion)) return PACKED_PAGE;
        return "file://" + new File(GameBundle.installedFolder(downloads), GameBundle.PAGE).getAbsolutePath();
    }

    private void lookForUpdate() {
        final long started = SystemClock.elapsedRealtime();
        new Thread(() -> {
            final String installed = UpdateCheck.run(LATEST_RELEASE, downloads, packedVersion);
            if (installed == null) return;
            runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                if (SystemClock.elapsedRealtime() - started < SWITCH_AT_ONCE_MS) {
                    view.loadUrl(pageToShow());
                } else {
                    Toast.makeText(this, "Ashport " + installed + " is ready. It starts the next time you open the game.", Toast.LENGTH_LONG).show();
                }
            });
        }, "update-check").start();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        view.saveState(outState);
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
    }
}
