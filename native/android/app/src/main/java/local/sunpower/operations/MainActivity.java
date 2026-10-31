package local.sunpower.operations;

import android.Manifest;
import android.app.*;
import android.os.Bundle;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.webkit.*;
import android.widget.*;
import android.view.ViewGroup;

/** A private, same-origin client. Business rules and accounts remain on the shared server. */
public class MainActivity extends Activity {
    private WebView web;
    private String server;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest cameraRequest;
    private boolean trusted(Uri uri) {
        Uri base = Uri.parse(server);
        return base.getScheme().equals(uri.getScheme()) && base.getHost().equals(uri.getHost()) && base.getPort() == uri.getPort();
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        server = getPreferences(0).getString("server", "http://localhost:3001");
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        layout.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        LinearLayout toolbar = new LinearLayout(this);
        button(toolbar, "Back", () -> { if (web.canGoBack()) web.goBack(); });
        button(toolbar, "Refresh", () -> web.reload());
        button(toolbar, "Server", this::configure);
        layout.addView(toolbar);
        web = new WebView(this);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(true);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) { CookieManager.getInstance().flush(); }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !trusted(request.getUrl()); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) Toast.makeText(MainActivity.this, "Cannot connect. Check the server address and connection, then refresh.", Toast.LENGTH_LONG).show();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (!trusted(request.getOrigin()) || !java.util.Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) { request.deny(); return; }
                    if (cameraRequest != null) cameraRequest.deny();
                    cameraRequest = request;
                    if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) finishCamera(true);
                    else requestPermissions(new String[]{Manifest.permission.CAMERA}, 20);
                });
            }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) { if (cameraRequest == request) cameraRequest = null; }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT); intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("image/*");
                try { startActivityForResult(intent, 21); } catch (ActivityNotFoundException e) { callback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
        });
        layout.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        setContentView(layout); web.loadUrl(server);
    }
    private void button(LinearLayout row, String label, Runnable action) {
        Button b = new Button(this); b.setText(label); b.setOnClickListener(v -> action.run());
        row.addView(b, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
    }
    private void configure() {
        EditText field = new EditText(this); field.setSingleLine(true); field.setText(server);
        new AlertDialog.Builder(this).setTitle("SunPower server").setMessage("Use your shared HTTPS server, or http://localhost:3001 with USB forwarding. Changing server signs you out.")
            .setView(field).setNegativeButton("Cancel", null).setPositiveButton("Connect", (d,w) -> {
                try {
                    Uri uri = Uri.parse(field.getText().toString().trim());
                    boolean local = "localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost());
                    if (uri.getHost() == null || uri.getUserInfo() != null || !("https".equals(uri.getScheme()) || local && "http".equals(uri.getScheme()))) throw new IllegalArgumentException();
                    server = uri.buildUpon().path("").clearQuery().fragment(null).build().toString();
                    getPreferences(0).edit().putString("server", server).apply();
                    CookieManager.getInstance().removeAllCookies(done -> { web.clearCache(true); web.clearHistory(); web.loadUrl(server); });
                } catch (Exception error) { Toast.makeText(this, "Enter a valid HTTPS server or localhost address.", Toast.LENGTH_LONG).show(); }
            }).show();
    }
    private void finishCamera(boolean allowed) {
        if (cameraRequest != null) { if (allowed) cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}); else cameraRequest.deny(); cameraRequest = null; }
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == 20) finishCamera(results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED);
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 21 && fileCallback != null) { fileCallback.onReceiveValue(result == RESULT_OK && data != null ? new Uri[]{data.getData()} : null); fileCallback = null; }
    }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onPause() { CookieManager.getInstance().flush(); web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { finishCamera(false); if (fileCallback != null) fileCallback.onReceiveValue(null); web.destroy(); super.onDestroy(); }
}
