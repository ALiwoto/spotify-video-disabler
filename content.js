const storageKey = 'videoDisablerEnabled';
const disabledClass = 'video-disabled-by-extension';
const listenerAttachedFlag = 'data-play-listener-attached'; // Flag to avoid attaching multiple listeners

// Function to handle the 'play' event on a video
function handlePlayAttempt(event) {
    const video = event.target;
    // Check if the listener logic is already running for this 
    // event cycle to prevent potential loops
    if (video.isPausingDueToExtension) {
        return;
    }

    chrome.storage.local.get([storageKey], (result) => {
        const isEnabled = result[storageKey] || false; // Default to disabled
        if (isEnabled) {
            // If the extension is enabled (meaning videos SHOULD be disabled),
            // and the video is trying to play, pause it immediately.
            console.log('Detected play attempt while extension is enabled. Pausing video:', video.src || video.currentSrc || 'local video');
            video.isPausingDueToExtension = true; // Set flag before pausing
            video.pause();
            // Maybe re-apply styles just in case the site removed them
            video.style.pointerEvents = 'none';
            video.classList.add(disabledClass);
            // Reset the flag shortly after, allowing future legitimate pauses
            setTimeout(() => { video.isPausingDueToExtension = false; }, 0);
        }
        // If isEnabled is false, do nothing, let the video play.
    });
}

// Function to enable or disable a specific video element AND attach listener
function setVideoState(video, shouldDisable) {
    if (shouldDisable) {
        if (!video.paused) {
            video.pause(); // Pause if playing
        }
        video.style.pointerEvents = 'none';
        video.classList.add(disabledClass);

        // Attach the persistent play listener IF it hasn't been attached yet
        if (!video.hasAttribute(listenerAttachedFlag)) {
            video.addEventListener('play', handlePlayAttempt);
            video.setAttribute(listenerAttachedFlag, 'true');
            console.log('Attached play listener to video:', video.src || video.currentSrc || 'local video');
        }
    } else {
        // Re-enable the video
        video.style.pointerEvents = 'auto';
        video.classList.remove(disabledClass);
        // We can leave the 'play' listener attached. It checks the extension
        // state anyway, so it won't interfere when the extension is disabled.
        // Removing listeners dynamically adds complexity we might not need.
    }
}

// Function to process all videos currently on the page based on stored state
function processAllVideos() {
    chrome.storage.local.get([storageKey], (result) => {
        const isEnabled = result[storageKey] || false; // Default to disabled
        console.log(`Content Script: Processing all videos. Extension enabled = ${isEnabled}`);
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            setVideoState(video, isEnabled);
        });
    });
}

// --- Initial Execution & Listeners ---

// 1. Process videos when the script first loads
processAllVideos();

// 2. Listen for messages from the popup (immediate update)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "updateState") {
        console.log('Content Script: Received state update from popup. Enabled =', message.isEnabled);
        // Re-process all videos based on the new state
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            setVideoState(video, message.isEnabled);
        });
    }
});

// 3. Use MutationObserver to handle dynamically added videos
const observer = new MutationObserver((mutationsList) => {
    chrome.storage.local.get([storageKey], (result) => { // Get current state *once* per mutation batch
        const isEnabled = result[storageKey] || false;

        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    let videosToAddListenerTo = [];
                    // Check if the added node is a video itself
                    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'VIDEO') {
                        videosToAddListenerTo.push(node);
                    }
                    // Check if the added node *contains* video elements
                    else if (node.nodeType === Node.ELEMENT_NODE && node.querySelectorAll) {
                        const nestedVideos = node.querySelectorAll('video');
                        if (nestedVideos.length > 0) {
                            videosToAddListenerTo.push(...nestedVideos);
                        }
                    }

                    if (videosToAddListenerTo.length > 0) {
                        console.log(`Dynamically added ${videosToAddListenerTo.length} video(s). Processing...`);
                        videosToAddListenerTo.forEach(video => {
                            setVideoState(video, isEnabled); // Apply current state and attach listener
                        });
                    }
                });
            }
        }
    });
});

// Start observing the document body for added nodes
observer.observe(document.body, { childList: true, subtree: true });