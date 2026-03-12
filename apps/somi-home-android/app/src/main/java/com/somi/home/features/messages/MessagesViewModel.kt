package com.somi.home.features.messages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.somi.home.core.auth.AuthRepository
import com.somi.home.core.auth.AuthState
import com.somi.home.core.connectivity.ConnectivityObserver
import com.somi.home.core.models.Message
import com.somi.home.core.models.SendMessageRequest
import com.somi.home.core.network.ApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class MessagesUiState {
    data object Loading : MessagesUiState()
    data class Success(
        val messages: List<Message>,
        val currentUserId: String,
        val threadId: String,
        val hasMore: Boolean = false,
        val nextCursor: String? = null,
        val isSending: Boolean = false,
        val errorMessage: String? = null
    ) : MessagesUiState()
    data class Error(val message: String) : MessagesUiState()
}

@HiltViewModel
class MessagesViewModel @Inject constructor(
    private val apiService: ApiService,
    private val authRepository: AuthRepository,
    private val connectivityObserver: ConnectivityObserver
) : ViewModel() {

    private val _uiState = MutableStateFlow<MessagesUiState>(MessagesUiState.Loading)
    val uiState: StateFlow<MessagesUiState> = _uiState.asStateFlow()

    val isOnline: StateFlow<Boolean> = connectivityObserver.isOnline

    private val _messageText = MutableStateFlow("")
    val messageText: StateFlow<String> = _messageText.asStateFlow()

    init {
        loadMessages()
    }

    fun updateMessageText(text: String) {
        _messageText.value = text
    }

    fun loadMessages() {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.value = MessagesUiState.Loading
            try {
                val thread = apiService.getThread()
                val pagedMessages = apiService.listMessages(thread.threadId)

                val currentUserId = when (val auth = authRepository.authState.value) {
                    is AuthState.Authenticated -> auth.userId
                    else -> ""
                }

                _uiState.value = MessagesUiState.Success(
                    messages = pagedMessages.items,
                    currentUserId = currentUserId,
                    threadId = thread.threadId,
                    hasMore = pagedMessages.nextCursor != null,
                    nextCursor = pagedMessages.nextCursor
                )
            } catch (e: Exception) {
                _uiState.value = MessagesUiState.Error(
                    e.message ?: "Failed to load messages"
                )
            }
        }
    }

    fun sendMessage() {
        val text = _messageText.value.trim()
        if (text.isEmpty()) return

        val currentState = _uiState.value
        if (currentState !is MessagesUiState.Success) return
        if (currentState.isSending) return

        _uiState.value = currentState.copy(isSending = true, errorMessage = null)

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val sentMessage = apiService.sendMessage(
                    threadId = currentState.threadId,
                    body = SendMessageRequest(text = text)
                )
                _messageText.value = ""
                _uiState.value = currentState.copy(
                    messages = currentState.messages + sentMessage,
                    isSending = false
                )
            } catch (e: Exception) {
                _uiState.value = currentState.copy(
                    isSending = false,
                    errorMessage = "Failed to send message. Please try again."
                )
            }
        }
    }

    fun loadMore() {
        val currentState = _uiState.value
        if (currentState !is MessagesUiState.Success) return
        val cursor = currentState.nextCursor ?: return

        viewModelScope.launch(Dispatchers.IO) {
            try {
                val pagedMessages = apiService.listMessages(
                    threadId = currentState.threadId,
                    cursor = cursor
                )
                _uiState.value = currentState.copy(
                    messages = pagedMessages.items + currentState.messages,
                    hasMore = pagedMessages.nextCursor != null,
                    nextCursor = pagedMessages.nextCursor
                )
            } catch (_: Exception) {
                // Silently fail on load more
            }
        }
    }

    fun clearError() {
        val currentState = _uiState.value
        if (currentState is MessagesUiState.Success) {
            _uiState.value = currentState.copy(errorMessage = null)
        }
    }
}
