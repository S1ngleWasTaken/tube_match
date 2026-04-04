let currentVideoId = null;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => { //listens for tab updates and checks if the url is a youtube video
    if (changeInfo.status === "complete" && tab.url && tab.url.includes("youtube.com/watch")) {
        // get supabase credentials from local storage
        chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'username'], (result) => {
            const supaUrl = result.supabaseUrl;
            const supaKey = result.supabaseKey;
            const username = result.username;

            if (!supaUrl || !supaKey || !username) {
                console.log("Supabase credentials or username not found in storage.");
                return;
            }

            const currentVideoId = getYoutubeVideoId(tab.url);
            if (!currentVideoId) return;

            console.log("Current Video ID:", currentVideoId);

            const headers = {
                'apikey': supaKey,
                'Authorization': `Bearer ${supaKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            };

            // Passing data as an object that Supabase expects
            insertToSupabase({ video_id: currentVideoId, username: username }, headers, supaUrl);
        });
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
    }
    return null;
}

async function insertToSupabase(videoData, headers, supaUrl) {
    try {
        const tableName = 'watch_history'
        const response = await fetch(`${supaUrl}/rest/v1/${tableName}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(videoData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Insert successful:', data);
        return { success: true, data: data };

    } catch (error) {
        if (error.message.includes("409")) {
            console.log("Video id is already saved");
        } else {
            console.error('Background insert failed:', error);
        }
        return { success: false, error: error.message };
    }
}