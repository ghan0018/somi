package com.somi.home.core.database

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingCompletionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(item: PendingCompletionEntity)

    @Query("SELECT * FROM pending_completions ORDER BY createdAt ASC")
    suspend fun getAll(): List<PendingCompletionEntity>

    @Delete
    suspend fun delete(item: PendingCompletionEntity)

    @Query("UPDATE pending_completions SET syncAttempts = syncAttempts + 1 WHERE id = :id")
    suspend fun incrementAttempts(id: String)

    @Query("SELECT COUNT(*) FROM pending_completions")
    fun getPendingCount(): Flow<Int>
}
