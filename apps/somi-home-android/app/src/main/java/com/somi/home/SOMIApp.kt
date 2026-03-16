package com.somi.home

import android.app.Application
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.somi.home.core.sync.CompletionSyncWorker
import dagger.hilt.android.HiltAndroidApp
import java.util.concurrent.TimeUnit

@HiltAndroidApp
class SOMIApp : Application() {
    override fun onCreate() {
        super.onCreate()

        val syncRequest = PeriodicWorkRequestBuilder<CompletionSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "completion_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
    }
}
