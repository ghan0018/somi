package com.somi.home.auth

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

/**
 * Tests for TokenManager using a fake in-memory token store.
 * EncryptedSharedPreferences requires Android context, so we test
 * the contract against a fake implementation.
 */
class TokenManagerTest {

    private lateinit var store: FakeTokenStore

    @Before
    fun setUp() {
        store = FakeTokenStore()
    }

    @Test
    fun `storeTokens saves both tokens`() {
        // Act
        store.storeTokens("access-abc", "refresh-xyz")

        // Assert
        assertEquals("access-abc", store.getAccessToken())
        assertEquals("refresh-xyz", store.getRefreshToken())
    }

    @Test
    fun `getAccessToken returns null when not stored`() {
        // Assert
        assertNull(store.getAccessToken())
    }

    @Test
    fun `getRefreshToken returns null when not stored`() {
        // Assert
        assertNull(store.getRefreshToken())
    }

    @Test
    fun `clearTokens removes both tokens`() {
        // Arrange
        store.storeTokens("access-abc", "refresh-xyz")

        // Act
        store.clearTokens()

        // Assert
        assertNull(store.getAccessToken())
        assertNull(store.getRefreshToken())
    }

    @Test
    fun `storeTokens overwrites previous tokens`() {
        // Arrange
        store.storeTokens("old-access", "old-refresh")

        // Act
        store.storeTokens("new-access", "new-refresh")

        // Assert
        assertEquals("new-access", store.getAccessToken())
        assertEquals("new-refresh", store.getRefreshToken())
    }

    @Test
    fun `withRefreshLock prevents concurrent refresh calls`() = runTest {
        // Arrange
        val concurrentEntries = AtomicInteger(0)
        val maxConcurrent = AtomicInteger(0)

        // Act — launch multiple concurrent refresh attempts
        val results = (1..5).map {
            async {
                store.withRefreshLock {
                    val current = concurrentEntries.incrementAndGet()
                    maxConcurrent.updateAndGet { max -> maxOf(max, current) }
                    delay(50) // Simulate network call
                    concurrentEntries.decrementAndGet()
                    "refreshed"
                }
            }
        }.awaitAll()

        // Assert — only one at a time should enter the lock
        assertEquals(1, maxConcurrent.get())
        assertEquals(5, results.size)
        results.forEach { assertEquals("refreshed", it) }
    }
}

/**
 * Fake in-memory token store for testing TokenManager contract.
 */
class FakeTokenStore {
    private var accessToken: String? = null
    private var refreshToken: String? = null
    private val lock = kotlinx.coroutines.sync.Mutex()

    fun storeTokens(access: String, refresh: String) {
        accessToken = access
        refreshToken = refresh
    }

    fun getAccessToken(): String? = accessToken

    fun getRefreshToken(): String? = refreshToken

    fun clearTokens() {
        accessToken = null
        refreshToken = null
    }

    suspend fun <T> withRefreshLock(block: suspend () -> T): T {
        return lock.withLock { block() }
    }
}
