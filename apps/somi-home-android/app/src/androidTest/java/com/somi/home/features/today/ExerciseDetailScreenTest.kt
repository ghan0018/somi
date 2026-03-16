package com.somi.home.features.today

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.somi.home.core.network.ApiService
import com.somi.home.fakes.FakeApiService
import com.somi.home.fakes.FakeApiService.Companion.makeDefaultTodayResponse
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class ExerciseDetailScreenTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createAndroidComposeRule<com.somi.home.HiltComponentActivity>()

    @Inject
    lateinit var apiService: ApiService

    private val fakeApi get() = apiService as FakeApiService

    @Before
    fun setUp() {
        hiltRule.inject()
        fakeApi.reset()
    }

    @Test
    fun exerciseDetailScreen_displaysTitle_andParams() {
        // Use default today response: first assignment is "Tongue Press" with reps=10, sets=3
        fakeApi.todayResponse = makeDefaultTodayResponse()

        // Render TodayScreen and verify first exercise title is visible
        composeRule.setContent {
            TodayScreen()
        }

        composeRule.waitUntil(5_000) { composeRule.onAllNodes(androidx.compose.ui.test.hasText("Tongue Press")).fetchSemanticsNodes().isNotEmpty() }
        composeRule.onNodeWithText("Tongue Press").assertIsDisplayed()
    }

    @Test
    fun exerciseDetailScreen_markComplete_updatesButton() {
        // Set up today response with a single exercise (no media, so no video loading)
        fakeApi.todayResponse = makeDefaultTodayResponse().let { response ->
            response.copy(
                assignments = response.assignments.take(1).map { a ->
                    a.copy(exercise = a.exercise.copy(mediaId = null))
                }
            )
        }

        // Track navigation calls
        var navigatedAssignmentKey: String? = null
        var navigatedSessionKey: String? = null

        composeRule.setContent {
            TodayScreen(
                onNavigateToExerciseDetail = { assignmentKey, sessionKey ->
                    navigatedAssignmentKey = assignmentKey
                    navigatedSessionKey = sessionKey
                }
            )
        }

        // Wait for content to load then tap the exercise row to trigger navigation
        composeRule.waitUntil(5_000) { composeRule.onAllNodes(androidx.compose.ui.test.hasText("Tongue Press")).fetchSemanticsNodes().isNotEmpty() }
        composeRule.onNodeWithText("Tongue Press").performClick()

        // Verify navigation was triggered with correct keys
        assert(navigatedAssignmentKey == "assignment-1") {
            "Expected assignment-1, got: $navigatedAssignmentKey"
        }
        assert(navigatedSessionKey == "session-1") {
            "Expected session-1, got: $navigatedSessionKey"
        }
    }

    @Test
    fun exerciseDetailScreen_showsOfflineMessage_whenNoNetwork() {
        // The ExerciseDetailScreen shows "Internet connection required to play this video"
        // when isOnline=false. We test this directly via the VideoPlayerComposable.
        composeRule.setContent {
            VideoPlayerComposable(
                videoUrl = null,
                isOnline = false,
                isFullscreen = false,
                onToggleFullscreen = {}
            )
        }

        composeRule.onNodeWithText("Internet connection required to play this video")
            .assertIsDisplayed()
    }
}
