package com.somi.home.features.today

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.somi.home.core.network.ApiService
import com.somi.home.fakes.FakeApiService
import com.somi.home.fakes.FakeApiService.Companion.makeAllDoneResponse
import com.somi.home.fakes.FakeApiService.Companion.makeCongratsResponse
import com.somi.home.fakes.FakeApiService.Companion.makeDefaultTodayResponse
import com.somi.home.fakes.FakeApiService.Companion.makeEmptyResponse
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import javax.inject.Inject

@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class TodayScreenTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    // Use HiltTestActivity — a bare ComponentActivity that doesn't call setContent,
    // so our tests can call composeRule.setContent { ... } freely.
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
    fun todayScreen_showsExerciseList_onLoad() {
        fakeApi.todayResponse = makeDefaultTodayResponse()

        composeRule.setContent {
            TodayScreen()
        }

        composeRule.waitUntil(5_000) { composeRule.onAllNodes(androidx.compose.ui.test.hasText("Tongue Press")).fetchSemanticsNodes().isNotEmpty() }
        composeRule.onNodeWithText("Tongue Press").assertIsDisplayed()
        composeRule.onNodeWithText("Nasal Breathing").assertIsDisplayed()
    }

    @Test
    fun todayScreen_showsSessionNotes_whenPresent() {
        fakeApi.todayResponse = makeDefaultTodayResponse(sessionNotes = "Do these daily")

        composeRule.setContent {
            TodayScreen()
        }

        composeRule.waitUntil(5_000) { composeRule.onAllNodes(androidx.compose.ui.test.hasText("Do these daily")).fetchSemanticsNodes().isNotEmpty() }
        composeRule.onNodeWithText("Do these daily").assertIsDisplayed()
    }

    @Test
    fun todayScreen_showsTimesPerDay_whenMultipleRounds() {
        fakeApi.todayResponse = makeDefaultTodayResponse(timesPerDay = 2)

        composeRule.setContent {
            TodayScreen()
        }

        composeRule.waitUntil(5_000) { composeRule.onAllNodes(androidx.compose.ui.test.hasText("0 / 2 times today")).fetchSemanticsNodes().isNotEmpty() }
        composeRule.onNodeWithText("0 / 2 times today").assertIsDisplayed()
    }

    @Test
    fun todayScreen_showsCongratsDialog_whenRoundCompletes() {
        fakeApi.todayResponse = makeCongratsResponse()

        composeRule.setContent {
            TodayScreen()
        }

        // Tap the completion circle for the single exercise
        composeRule.onNodeWithTag("completion_circle_assignment-congrats").performClick()

        // Congrats dialog should appear
        composeRule.onNodeWithText("Round complete!").assertIsDisplayed()
    }

    @Test
    fun todayScreen_showsAllDoneState_whenAllComplete() {
        fakeApi.todayResponse = makeAllDoneResponse(timesPerDay = 1)

        composeRule.setContent {
            TodayScreen()
        }

        composeRule.waitUntil(5_000) { composeRule.onAllNodes(androidx.compose.ui.test.hasText("Great work today!", substring = true)).fetchSemanticsNodes().isNotEmpty() }
        composeRule.onNodeWithText("Great work today!", substring = true).assertIsDisplayed()
    }

    @Test
    fun todayScreen_showsEmptyState_whenNoAssignments() {
        fakeApi.todayResponse = makeEmptyResponse()

        composeRule.setContent {
            TodayScreen()
        }

        composeRule.waitUntil(5_000) { composeRule.onAllNodes(androidx.compose.ui.test.hasText("No exercises scheduled for today")).fetchSemanticsNodes().isNotEmpty() }
        composeRule.onNodeWithText("No exercises scheduled for today").assertIsDisplayed()
    }
}
