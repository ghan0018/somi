package com.somi.home.navigation

object NavRoutes {
    const val TODAY = "today"
    const val EXERCISE_DETAIL = "exercise_detail/{assignmentKey}/{sessionKey}"
    const val PLAN = "plan"
    const val MESSAGES = "messages"
    const val PROFILE = "profile"

    fun exerciseDetail(assignmentKey: String, sessionKey: String): String =
        "exercise_detail/$assignmentKey/$sessionKey"
}
