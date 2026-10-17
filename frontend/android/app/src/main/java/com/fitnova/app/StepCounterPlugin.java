package com.fitnova.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(alias = "activityRecognition", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class StepCounterPlugin extends Plugin {
    private static final String[] DAY_LABELS = { "월", "화", "수", "목", "금", "토", "일" };

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (!hasActivityRecognitionPermission()) {
            requestPermissionForAlias("activityRecognition", call, "permissionCallback");
            return;
        }
        startService();
        call.resolve(new JSObject().put("granted", true));
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        boolean granted = getPermissionState("activityRecognition") == PermissionState.GRANTED;
        if (granted) startService();
        call.resolve(new JSObject().put("granted", granted));
    }

    @PluginMethod
    public void getWeeklySteps(PluginCall call) {
        Context context = getContext();
        SensorManager manager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        boolean supported = manager != null && manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
        boolean granted = hasActivityRecognitionPermission();
        JSArray days = new JSArray();
        JSObject result = new JSObject();
        result.put("supported", supported);
        result.put("permissionGranted", granted);
        result.put("tracking", StepCounterService.isTracking(context));

        Calendar today = Calendar.getInstance();
        Calendar monday = (Calendar) today.clone();
        int mondayOffset = (monday.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        monday.add(Calendar.DAY_OF_MONTH, -mondayOffset);
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        String todayKey = dateFormat.format(today.getTime());
        int weekTotal = 0;
        for (int index = 0; index < 7; index++) {
            Calendar date = (Calendar) monday.clone();
            date.add(Calendar.DAY_OF_MONTH, index);
            String dateKey = dateFormat.format(date.getTime());
            int count = StepCounterService.getSteps(context, dateKey);
            weekTotal += count;
            JSObject day = new JSObject();
            day.put("date", dateKey);
            day.put("label", DAY_LABELS[index]);
            day.put("steps", count);
            day.put("isToday", dateKey.equals(todayKey));
            days.put(day);
        }
        result.put("todaySteps", StepCounterService.getSteps(context, todayKey));
        result.put("weekSteps", weekTotal);
        result.put("days", days);
        call.resolve(result);
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        getContext().getSharedPreferences("fitnova_step_counter", Context.MODE_PRIVATE)
            .edit().putBoolean("enabled", false).apply();
        getContext().stopService(new Intent(getContext(), StepCounterService.class));
        call.resolve(new JSObject().put("stopped", true));
    }

    private boolean hasActivityRecognitionPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    private void startService() {
        getContext().getSharedPreferences("fitnova_step_counter", Context.MODE_PRIVATE)
            .edit().putBoolean("enabled", true).putBoolean("tracking", true).apply();
        Intent intent = new Intent(getContext(), StepCounterService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
        else getContext().startService(intent);
    }
}
