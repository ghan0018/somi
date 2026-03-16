package com.somi.home.core.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkerParameters
import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.models.CompletionRequest
import com.somi.home.core.network.ApiService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import retrofit2.HttpException
import java.io.IOException

@HiltWorker
class CompletionSyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val apiService: ApiService,
    private val dao: PendingCompletionDao
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val pending = dao.getAll()
        var hasErrors = false

        for (item in pending) {
            try {
                apiService.postCompletion(
                    idempotencyKey = item.idempotencyKey,
                    body = CompletionRequest(
                        dateLocal = item.dateLocal,
                        occurrence = item.occurrence,
                        exerciseVersionId = item.exerciseVersionId,
                        source = item.source
                    )
                )
                dao.delete(item)
            } catch (e: HttpException) {
                if (e.code() == 409) {
                    // Already recorded — treat as success
                    dao.delete(item)
                } else if (e.code() in 400..499) {
                    // Permanent client error — discard
                    dao.delete(item)
                } else {
                    dao.incrementAttempts(item.id)
                    hasErrors = true
                }
            } catch (_: IOException) {
                dao.incrementAttempts(item.id)
                hasErrors = true
            }
        }

        return if (hasErrors) Result.retry() else Result.success()
    }

    companion object {
        fun buildRequest() = OneTimeWorkRequestBuilder<CompletionSyncWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
    }
}
