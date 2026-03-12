package com.somi.home.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.somi.home.R
import com.somi.home.ui.theme.SomiGold

@Composable
fun SyncBadge(pendingCount: Int, modifier: Modifier = Modifier) {
    if (pendingCount <= 0) return

    Row(
        modifier = modifier
            .background(
                color = SomiGold.copy(alpha = 0.15f),
                shape = RoundedCornerShape(8.dp)
            )
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.CloudSync,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = SomiGold
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = stringResource(R.string.pending_sync, pendingCount),
            style = MaterialTheme.typography.labelMedium,
            color = SomiGold
        )
    }
}
