package com.somi.home.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.somi.home.core.models.ExerciseParams
import com.somi.home.ui.theme.SomiTeal

@Composable
fun ParameterChip(label: String, modifier: Modifier = Modifier) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelMedium,
        color = SomiTeal,
        modifier = modifier
            .background(
                color = SomiTeal.copy(alpha = 0.1f),
                shape = RoundedCornerShape(6.dp)
            )
            .padding(horizontal = 8.dp, vertical = 4.dp)
    )
}

@Composable
fun ParameterChipsRow(params: ExerciseParams, modifier: Modifier = Modifier) {
    Row(modifier = modifier) {
        params.sets?.let {
            ParameterChip(label = "$it sets")
            Spacer(modifier = Modifier.width(6.dp))
        }
        params.reps?.let {
            ParameterChip(label = "$it reps")
            Spacer(modifier = Modifier.width(6.dp))
        }
        params.seconds?.let {
            ParameterChip(label = "${it}s hold")
        }
    }
}

fun effectiveParams(defaultParams: ExerciseParams, paramsOverride: ExerciseParams?): ExerciseParams {
    if (paramsOverride == null) return defaultParams
    return ExerciseParams(
        reps = paramsOverride.reps ?: defaultParams.reps,
        sets = paramsOverride.sets ?: defaultParams.sets,
        seconds = paramsOverride.seconds ?: defaultParams.seconds
    )
}
