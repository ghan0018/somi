package com.somi.home.features.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.somi.home.core.auth.AuthRepository
import com.somi.home.core.auth.AuthState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    val authState: StateFlow<AuthState> = authRepository.authState

    fun signOut() {
        viewModelScope.launch(Dispatchers.IO) {
            authRepository.signOut()
        }
    }
}
