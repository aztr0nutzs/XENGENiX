// Golden Compose screen template used as a structural example for this repo.
// Replace names, models, and add the referenced R.string values to strings.xml.

package com.xenogenics.app.ui.example

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import com.xenogenics.app.R

// UiState and events

data class ExampleUiState(
    val isLoading: Boolean = false,
    val hasError: Boolean = false,
    val items: List<String> = emptyList()
)

sealed interface ExampleEvent {
    data object Retry : ExampleEvent
    data object PrimaryAction : ExampleEvent
}

class ExampleViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(ExampleUiState(isLoading = true))
    val uiState: StateFlow<ExampleUiState> = _uiState.asStateFlow()

    fun onEvent(event: ExampleEvent) {
        when (event) {
            ExampleEvent.Retry -> load()
            ExampleEvent.PrimaryAction -> {
                // Trigger action or navigation via callback in screen.
            }
        }
    }

    private fun load() {
        viewModelScope.launch {
            _uiState.value = ExampleUiState(isLoading = false, items = listOf("A", "B"))
        }
    }
}

@Composable
fun ExampleRoute(
    viewModel: ExampleViewModel,
    onPrimaryAction: () -> Unit
) {
    val uiState = viewModel.uiState.collectAsStateWithLifecycle().value
    ExampleScreen(
        uiState = uiState,
        onEvent = { event ->
            if (event == ExampleEvent.PrimaryAction) onPrimaryAction()
            viewModel.onEvent(event)
        }
    )
}

@Composable
fun ExampleScreen(
    uiState: ExampleUiState,
    onEvent: (ExampleEvent) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(title = { Text(stringResource(id = R.string.example_title)) })
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            when {
                uiState.isLoading -> Text(text = stringResource(id = R.string.example_loading))
                uiState.hasError -> {
                    Text(text = stringResource(id = R.string.example_error))
                    Button(onClick = { onEvent(ExampleEvent.Retry) }) {
                        Text(text = stringResource(id = R.string.example_retry))
                    }
                }
                uiState.items.isEmpty() -> Text(text = stringResource(id = R.string.example_empty))
                else -> {
                    Text(text = stringResource(id = R.string.example_content))
                    Button(onClick = { onEvent(ExampleEvent.PrimaryAction) }) {
                        Text(text = stringResource(id = R.string.example_continue))
                    }
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun ExamplePreviewLoading() {
    ExampleScreen(uiState = ExampleUiState(isLoading = true), onEvent = {})
}

@Preview(showBackground = true)
@Composable
private fun ExamplePreviewContent() {
    ExampleScreen(uiState = ExampleUiState(items = listOf("A", "B")), onEvent = {})
}

@Preview(showBackground = true)
@Composable
private fun ExamplePreviewError() {
    ExampleScreen(uiState = ExampleUiState(hasError = true), onEvent = {})
}
