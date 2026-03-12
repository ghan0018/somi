package com.somi.home.core.auth

sealed class AuthState {
    data object Unauthenticated : AuthState()
    data class Authenticated(
        val userId: String,
        val patientId: String,
        val displayName: String
    ) : AuthState()
}
