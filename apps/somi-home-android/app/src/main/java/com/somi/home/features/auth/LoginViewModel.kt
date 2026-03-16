package com.somi.home.features.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.somi.home.core.auth.AuthRepository
import com.somi.home.core.auth.NotAPatientException
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun updateEmail(email: String) {
        _uiState.value = _uiState.value.copy(email = email, errorMessage = null)
    }

    fun updatePassword(password: String) {
        _uiState.value = _uiState.value.copy(password = password, errorMessage = null)
    }

    fun login() {
        val state = _uiState.value
        if (state.email.isBlank() || state.password.isBlank()) return

        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, errorMessage = null)

            val result = authRepository.login(state.email.trim(), state.password)

            result.fold(
                onSuccess = {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                },
                onFailure = { error ->
                    val message = when (error) {
                        is NotAPatientException -> error.message ?: "Not a patient account"
                        is HttpException -> {
                            if (error.code() == 401) "Incorrect email or password"
                            else "Something went wrong. Please try again."
                        }
                        is IOException -> "No internet connection. Please try again."
                        else -> "Something went wrong. Please try again."
                    }
                    _uiState.value = _uiState.value.copy(isLoading = false, errorMessage = message)
                }
            )
        }
    }
}
