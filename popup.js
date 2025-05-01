const toggleButton = document.getElementById('toggleButton');
const statusDiv = document.getElementById('status');
const storageKey = 'videoDisablerEnabled'; // Key to store the state

// Function to update the button and status text
function updateUI(isEnabled) {
    if (isEnabled) {
        statusDiv.textContent = 'All videos will be paused.';
        toggleButton.textContent = 'Disable Extension';
    } else {
        statusDiv.textContent = 'Videos won\'t be touched :o';
        toggleButton.textContent = 'Enable Extension';
    }
}

// 1. Get the current state when the popup opens
chrome.storage.local.get([storageKey], (result) => {
    // Default to false (disabled) if not found in storage
    const isEnabled = result[storageKey] || false;
    updateUI(isEnabled);
});

// 2. Add click listener to the button
toggleButton.addEventListener('click', () => {
    // Get the current state again (to toggle it)
    chrome.storage.local.get([storageKey], (result) => {
        let currentIsEnabled = result[storageKey] || false;
        let newIsEnabled = !currentIsEnabled; // Toggle the state

        // Save the *new* state
        chrome.storage.local.set({ [storageKey]: newIsEnabled }, () => {
            // Update the UI after saving
            updateUI(newIsEnabled);
            console.log('Video Disabler state set to:', newIsEnabled);

            // Optional: Send a message to the active tab's content script
            // to update immediately without waiting for a page reload or storage change event.
            // This makes the change feel more instantaneous if the user is already on spotify
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]?.id) { // Check if we have a valid tab ID
                    chrome.tabs.sendMessage(tabs[0].id, {
                        command: "updateState",
                        isEnabled: newIsEnabled
                    });
                }
            });
        });
    });
});