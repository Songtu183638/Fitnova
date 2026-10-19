package com.fitnova.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class StepCounterService extends Service implements SensorEventListener {
    private static final String CHANNEL_ID = "fitnova_step_counter";
    private static final int NOTIFICATION_ID = 7312;
    private static final String PREFS = "fitnova_step_counter";
    private static final String TRACKING_KEY = "tracking";
    private static final String LAST_TOTAL_KEY = "last_sensor_total";

    private SensorManager sensorManager;
    private Sensor stepCounter;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        stepCounter = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (stepCounter != null) {
            sensorManager.registerListener(this, stepCounter, SensorManager.SENSOR_DELAY_NORMAL);
            updateNotification();
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(TRACKING_KEY, true).apply();
        } else {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(TRACKING_KEY, false).putBoolean("enabled", false).apply();
            stopSelf();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER || event.values.length == 0) return;
        long currentTotal = Math.round(event.values[0]);
        android.content.SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        long previousTotal = prefs.getLong(LAST_TOTAL_KEY, -1L);
        if (previousTotal >= 0 && currentTotal >= previousTotal) {
            long delta = currentTotal - previousTotal;
            if (delta > 0) {
                String dateKey = "steps_" + new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                int currentDaySteps = prefs.getInt(dateKey, 0);
                long updated = Math.min(Integer.MAX_VALUE, (long) currentDaySteps + delta);
                prefs.edit().putInt(dateKey, (int) updated).apply();
            }
        }
        // A lower sensor value means the device rebooted and its hardware counter reset.
        prefs.edit().putLong(LAST_TOTAL_KEY, currentTotal).apply();
        updateNotification();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    @Override
    public void onDestroy() {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(TRACKING_KEY, false).apply();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    static boolean isTracking(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(TRACKING_KEY, false);
    }

    static int getSteps(Context context, String date) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("steps_" + date, 0);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "만보기", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("FITNOVA가 걸음 수를 측정하고 있습니다.");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void updateNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        int steps = getSteps(this, today);
        double distanceKm = steps * 0.7d / 1000d;
        int calories = Math.round(steps * 0.04f);
        int progress = Math.min(10000, steps);
        String title = "FITNOVA · 오늘 " + String.format(Locale.KOREA, "%,d", steps) + "걸음";
        String details = String.format(Locale.KOREA, "거리 %.2fkm · 약 %,dkcal", distanceKm, calories);
        String expanded = String.format(Locale.KOREA, "오늘 %,d걸음\n거리 약 %.2fkm · 소모 열량 약 %,dkcal\n목표 10,000걸음 · %d%%", steps, distanceKm, calories, Math.min(100, Math.round(steps / 10000f * 100f)));
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = launchIntent == null ? null : PendingIntent.getActivity(
            this, 7312, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        builder.setSmallIcon(android.R.drawable.ic_menu_directions)
            .setContentTitle(title)
            .setContentText(details)
            .setStyle(new Notification.BigTextStyle().bigText(expanded))
            .setProgress(10000, progress, false)
            .setNumber(steps)
            .setCategory(Notification.CATEGORY_STATUS)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false);
        if (contentIntent != null) builder.setContentIntent(contentIntent);
        return builder.build();
    }
}
