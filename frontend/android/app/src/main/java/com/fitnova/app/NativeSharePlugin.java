package com.fitnova.app;

import android.content.Intent;
import android.text.TextUtils;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeShare")
public class NativeSharePlugin extends Plugin {
    @PluginMethod
    public void share(PluginCall call) {
        String title = call.getString("title", "Share with");
        String text = call.getString("text", "");
        String url = call.getString("url", "");
        String payload = text;
        if (!TextUtils.isEmpty(url) && (TextUtils.isEmpty(payload) || !payload.contains(url))) {
            payload = TextUtils.isEmpty(payload) ? url : payload + "\n" + url;
        }
        if (TextUtils.isEmpty(payload)) {
            call.reject("There is nothing to share.");
            return;
        }
        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        sendIntent.setType("text/plain");
        sendIntent.putExtra(Intent.EXTRA_TEXT, payload);
        sendIntent.putExtra(Intent.EXTRA_TITLE, title);
        try {
            getActivity().startActivity(Intent.createChooser(sendIntent, title));
            JSObject result = new JSObject();
            result.put("completed", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to open the Android share sheet.", error);
        }
    }
}
