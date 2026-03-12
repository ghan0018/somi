package com.somi.home.features.plan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.somi.home.core.models.TreatmentPlan
import com.somi.home.core.network.ApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class PlanUiState {
    data object Loading : PlanUiState()
    data object Empty : PlanUiState()
    data class Success(val plan: TreatmentPlan) : PlanUiState()
    data class Error(val message: String) : PlanUiState()
}

@HiltViewModel
class PlanViewModel @Inject constructor(
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlanUiState>(PlanUiState.Loading)
    val uiState: StateFlow<PlanUiState> = _uiState.asStateFlow()

    init {
        loadPlan()
    }

    fun loadPlan() {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.value = PlanUiState.Loading
            try {
                val response = apiService.getPlan()
                when {
                    response.code() == 404 -> _uiState.value = PlanUiState.Empty
                    response.isSuccessful -> {
                        val plan = response.body()
                        if (plan != null) {
                            _uiState.value = PlanUiState.Success(plan)
                        } else {
                            _uiState.value = PlanUiState.Empty
                        }
                    }
                    else -> _uiState.value = PlanUiState.Error("Failed to load plan")
                }
            } catch (e: Exception) {
                _uiState.value = PlanUiState.Error(
                    e.message ?: "Failed to load plan"
                )
            }
        }
    }
}
