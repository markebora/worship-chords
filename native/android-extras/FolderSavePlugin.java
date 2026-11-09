package app.disciples.worship;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

/* Lets the web app pick an export folder once (Android's folder picker)
   and then write files into it without asking again. */
@CapacitorPlugin(name = "FolderSave")
public class FolderSavePlugin extends Plugin {

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null
                || result.getData().getData() == null) {
            call.resolve(new JSObject());
            return;
        }
        Uri uri = result.getData().getData();
        getContext().getContentResolver().takePersistableUriPermission(uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        DocumentFile dir = DocumentFile.fromTreeUri(getContext(), uri);
        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        ret.put("name", dir != null && dir.getName() != null ? dir.getName() : "Selected folder");
        call.resolve(ret);
    }

    @PluginMethod
    public void hasAccess(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = false;
        try {
            Uri uri = Uri.parse(call.getString("uri", ""));
            DocumentFile dir = DocumentFile.fromTreeUri(getContext(), uri);
            granted = dir != null && dir.exists() && dir.canWrite();
        } catch (Exception ignored) { }
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        try {
            Uri uri = Uri.parse(call.getString("uri", ""));
            String filename = call.getString("filename", "export");
            String mime = call.getString("mimeType", "application/octet-stream");
            byte[] bytes = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
            DocumentFile dir = DocumentFile.fromTreeUri(getContext(), uri);
            if (dir == null || !dir.canWrite()) { call.reject("No access to folder"); return; }
            DocumentFile old = dir.findFile(filename);
            if (old != null) old.delete();
            DocumentFile file = dir.createFile(mime, filename);
            if (file == null) { call.reject("Could not create file"); return; }
            try (OutputStream out = getContext().getContentResolver().openOutputStream(file.getUri())) {
                out.write(bytes);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Save failed: " + e.getMessage());
        }
    }
}
