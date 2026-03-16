package com.somi.home.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_completions")
data class PendingCompletionEntity(
    @PrimaryKey val id: String,
    val dateLocal: String,
    val occurrence: Int,
    val exerciseVersionId: String,
    val idempotencyKey: String,
    val source: String,
    val createdAt: Long,
    val syncAttempts: Int = 0
)
