chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url && tab.url.includes("youtube.com/watch")) {
        const videoId = getYoutubeVideoId(tab.url);
        console.log(videoId);
    }
});

function getYoutubeVideoId(urlString) {
    try {
        const url = new URL(urlString);

        if (url.hostname.includes('youtube.com') && url.pathname === '/watch') {
            return url.searchParams.get('v');
        }
    } catch {
        console.log("Invalid URL");
        return null
    }
};