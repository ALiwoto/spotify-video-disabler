const storageKey = 'videoDisablerEnabled';
const disabledClass = 'video-disabled-by-extension'; // CSS class for styling

// Function to enable or disable video elements
function setVideoState(shouldDisable) {
    const videos = document.querySelectorAll('video');
    console.log(`Found ${videos.length} video(s). Setting state (disabled=${shouldDisable})`);

    videos.forEach(video => {
        if (shouldDisable) {
            video.pause(); // Stop playback
            // video.removeAttribute('controls'); // Optionally remove controls
            video.style.pointerEvents = 'none'; // Prevent clicking on the video
            video.classList.add(disabledClass); // Add class for CSS styling
        } else {
            // video.setAttribute('controls', ''); // Optionally restore controls if removed
            video.style.pointerEvents = 'auto'; // Allow clicking again
            video.classList.remove(disabledClass); // Remove styling class
            // We don't automatically play, let the user do that.
        }
    });
}

// Function to check storage and apply the state
function applyCurrentState() {
    chrome.storage.local.get([storageKey], (result) => {
        const isEnabled = result[storageKey] || false; // Default to disabled
        console.log('Content Script: Initial state check. Enabled =', isEnabled);
        setVideoState(isEnabled);
    });
}

// 1. Apply the state when the script first loads (page loads)
applyCurrentState();

// 2. Listen for messages from the popup (immediate update)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "updateState") {
        console.log('Content Script: Received state update from popup. Enabled =', message.isEnabled);
        setVideoState(message.isEnabled);
    }
    // If you needed to send a response back:
    // sendResponse({ status: "acknowledged" });
    // return true; // if you intend to send a response asynchronously
});


// --- Optional but Recommended: Handle dynamically added videos ---
// Use a MutationObserver to watch for videos added to the page *after* initial load.
const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                // Check if the added node is a video itself
                if (node.tagName === 'VIDEO') {
                    console.log("Dynamically added <video> detected.");
                    // Check current state and apply if needed
                    chrome.storage.local.get([storageKey], (result) => {
                        if (result[storageKey]) { // Only act if extension is enabled
                            setVideoState(true); // Re-run on all videos, easier than tracking just the new one
                        }
                    });
                }
                // Check if the added node *contains* video elements
                else if (node.querySelectorAll) {
                    const videos = node.querySelectorAll('video');
                    if (videos.length > 0) {
                        console.log("Dynamically added node containing <video>(s) detected.");
                        chrome.storage.local.get([storageKey], (result) => {
                            if (result[storageKey]) {
                                setVideoState(true); // Re-run on all videos
                            }
                        });
                    }
                }
            });
        }
    }
});

// Start observing the document body for added nodes
observer.observe(document.body, { childList: true, subtree: true });