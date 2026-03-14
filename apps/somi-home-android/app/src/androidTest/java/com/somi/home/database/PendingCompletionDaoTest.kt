package com.somi.home.database

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.somi.home.core.database.AppDatabase
import com.somi.home.core.database.PendingCompletionDao
import com.somi.home.core.database.PendingCompletionEntity
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class PendingCompletionDaoTest {

    private lateinit var db: AppDatabase
    private lateinit var dao: PendingCompletionDao

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        ).allowMainThreadQueries().build()
        dao = db.pendingCompletionDao()
    }

    @After
    fun tearDown() {
        db.close()
    }

    private fun makeEntity(
        id: String = UUID.randomUUID().toString(),
        dateLocal: String = "2026-03-12",
        occurrence: Int = 1,
        exerciseVersionId: String = "ev1",
        syncAttempts: Int = 0
    ) = PendingCompletionEntity(
        id = id,
        dateLocal = dateLocal,
        occurrence = occurrence,
        exerciseVersionId = exerciseVersionId,
        idempotencyKey = UUID.randomUUID().toString(),
        source = "mobile_android",
        syncAttempts = syncAttempts,
        createdAt = System.currentTimeMillis()
    )

    @Test
    fun insertAndGetAll() = runTest {
        // Arrange
        val entity1 = makeEntity(id = "id-1")
        val entity2 = makeEntity(id = "id-2", occurrence = 2)

        // Act
        dao.insert(entity1)
        dao.insert(entity2)
        val all = dao.getAll()

        // Assert
        assertEquals(2, all.size)
        assertEquals("id-1", all[0].id)
        assertEquals("id-2", all[1].id)
    }

    @Test
    fun delete() = runTest {
        // Arrange
        val entity = makeEntity(id = "id-to-delete")
        dao.insert(entity)
        assertEquals(1, dao.getAll().size)

        // Act
        val entityToDelete = dao.getAll().first { it.id == "id-to-delete" }
        dao.delete(entityToDelete)

        // Assert
        assertTrue(dao.getAll().isEmpty())
    }

    @Test
    fun incrementAttempts() = runTest {
        // Arrange
        val entity = makeEntity(id = "id-retry", syncAttempts = 0)
        dao.insert(entity)

        // Act
        dao.incrementAttempts("id-retry")
        dao.incrementAttempts("id-retry")

        // Assert
        val updated = dao.getAll().first { it.id == "id-retry" }
        assertEquals(2, updated.syncAttempts)
    }

    @Test
    fun getPendingCountEmitsCorrectly() = runTest {
        // Arrange — empty
        val initialCount = dao.getPendingCount().first()
        assertEquals(0, initialCount)

        // Act — insert 3 items
        dao.insert(makeEntity(id = "id-1"))
        dao.insert(makeEntity(id = "id-2"))
        dao.insert(makeEntity(id = "id-3"))

        // Assert
        val countAfterInsert = dao.getPendingCount().first()
        assertEquals(3, countAfterInsert)

        // Act — delete one
        val entityToDelete2 = dao.getAll().first { it.id == "id-2" }
        dao.delete(entityToDelete2)

        // Assert
        val countAfterDelete = dao.getPendingCount().first()
        assertEquals(2, countAfterDelete)
    }
}
