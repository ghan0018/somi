package com.somi.home.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.somi.home.R
import com.somi.home.core.auth.AuthRepository
import com.somi.home.core.auth.AuthState
import com.somi.home.features.auth.LoginScreen
import com.somi.home.features.messages.MessagesScreen
import com.somi.home.features.plan.PlanScreen
import com.somi.home.features.profile.ProfileScreen
import com.somi.home.features.today.ExerciseDetailScreen
import com.somi.home.features.today.TodayScreen
import com.somi.home.ui.theme.SomiTeal

data class BottomNavItem(
    val route: String,
    val labelRes: Int,
    val icon: ImageVector
)

@Composable
fun AppNavigation(authRepository: AuthRepository) {
    val authState by authRepository.authState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        authRepository.restoreSession()
    }

    when (authState) {
        is AuthState.Unauthenticated -> LoginScreen()
        is AuthState.Authenticated -> MainScaffold()
    }
}

@Composable
fun MainScaffold() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    val bottomNavItems = listOf(
        BottomNavItem(NavRoutes.TODAY, R.string.tab_today, Icons.Default.Today),
        BottomNavItem(NavRoutes.PLAN, R.string.tab_plan, Icons.Default.CalendarMonth),
        BottomNavItem(NavRoutes.MESSAGES, R.string.tab_messages, Icons.Default.ChatBubbleOutline),
        BottomNavItem(NavRoutes.PROFILE, R.string.tab_profile, Icons.Default.Person)
    )

    // Only show bottom bar for top-level destinations
    val showBottomBar = currentDestination?.hierarchy?.any { dest ->
        bottomNavItems.any { it.route == dest.route }
    } == true

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(containerColor = Color.White) {
                    bottomNavItems.forEach { item ->
                        val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                        NavigationBarItem(
                            icon = { Icon(item.icon, contentDescription = stringResource(item.labelRes)) },
                            label = { Text(stringResource(item.labelRes)) },
                            selected = selected,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(NavRoutes.TODAY) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = SomiTeal,
                                selectedTextColor = SomiTeal,
                                indicatorColor = SomiTeal.copy(alpha = 0.15f)
                            )
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = NavRoutes.TODAY,
            modifier = Modifier.padding(padding)
        ) {
            composable(NavRoutes.TODAY) {
                TodayScreen(
                    onNavigateToExerciseDetail = { assignmentKey, sessionKey ->
                        navController.navigate(NavRoutes.exerciseDetail(assignmentKey, sessionKey))
                    }
                )
            }
            composable(
                route = NavRoutes.EXERCISE_DETAIL,
                arguments = listOf(
                    navArgument("assignmentKey") { type = NavType.StringType },
                    navArgument("sessionKey") { type = NavType.StringType }
                )
            ) {
                ExerciseDetailScreen(onBack = { navController.popBackStack() })
            }
            composable(NavRoutes.PLAN) { PlanScreen() }
            composable(NavRoutes.MESSAGES) { MessagesScreen() }
            composable(NavRoutes.PROFILE) { ProfileScreen() }
        }
    }
}
