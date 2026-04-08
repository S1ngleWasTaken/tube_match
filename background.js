const tableName = 'watch_history'
let currentVideoId = null;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findMatches") {
        findMatches(request.videoId, request.username, request.daysBack, request.headers, request.supaUrl)
            .then(matches => sendResponse({ success: true, matches: matches }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async sendResponse
    } else if (request.action === "getAllMatches") {
        fetchAllMatches(request.username, request.headers, request.supaUrl)
            .then(matches => sendResponse({ success: true, matches: matches }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

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
            const videoTitle = tab.title;

            console.log("Current Video ID:", currentVideoId);

            const headers = {
                'apikey': supaKey,
                'Authorization': `Bearer ${supaKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            };

            insertToSupabase({ video_id: currentVideoId, username: username, video_title: videoTitle }, headers, supaUrl)
            // .then(() => {
            //     // Defaulting to 7 days back
            //     return findMatches(currentVideoId, username, 7, headers, supaUrl);
            // })
            // .then(matches => {
            //     if (matches && matches.length > 0) {
            //         console.log("Matches found:", matches);
            //         // Future: Send to popup or content script
            //     }
            // });
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
        const response = await fetch(`${supaUrl}/rest/v1/${tableName}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(videoData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 409) {
                // Return success if it's just a duplicate
                return { success: true, duplicate: true };
            }
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Insert successful:', data);
        return { success: true, data: data };

    } catch (error) {
        if (error.message.includes("409")) {
            console.log("Video id is already saved");
            return { success: true, duplicate: true };
        } else {
            console.error('Background insert failed:', error);
            return { success: false, error: error.message };
        }
    }
}

async function findMatches(videoId, myUsername, daysBack, headers, supaUrl) {
    try {
        // Calculate date cutoff
        const dateCutoff = new Date();
        dateCutoff.setDate(dateCutoff.getDate() - daysBack);
        const isoDate = dateCutoff.toISOString();

        // Query for same video within  range
        const url = `${supaUrl}/rest/v1/${tableName}?video_id=eq.${videoId}&username=neq.${myUsername}&created_at=gte.${isoDate}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`Found ${data.length} match(es) in the last ${daysBack} days.`);
        return data;

    } catch (error) {
        console.error('Failed to find matches:', error);
        return [];
    }
}

async function fetchAllMatches(myUsername, headers, supaUrl) {
    try {
        // all videos seen by the current user
        const myHistoryUrl = `${supaUrl}/rest/v1/${tableName}?username=eq.${myUsername}&select=video_id,video_title`;
        const myResponse = await fetch(myHistoryUrl, { method: 'GET', headers });

        if (!myResponse.ok) throw new Error(`HTTP error! status: ${myResponse.status}`);

        const myHistory = await myResponse.json();
        if (myHistory.length === 0) return [];

        const myVideoMap = {};
        myHistory.forEach(item => {
            myVideoMap[item.video_id] = item.video_title;
        });

        const myVideoIds = Object.keys(myVideoMap);

        // all entries for these videos from other users (not the best solution but the scale in use is so small it shouldnt matter :D)

        const allOthersUrl = `${supaUrl}/rest/v1/${tableName}?username=neq.${myUsername}`;
        const othersResponse = await fetch(allOthersUrl, { method: 'GET', headers });

        if (!othersResponse.ok) throw new Error(`HTTP error! status: ${othersResponse.status}`);

        const othersHistory = await othersResponse.json();


        // group matches
        const matchesGrouped = {};

        othersHistory.forEach(record => {
            if (myVideoMap[record.video_id]) { // current user seen it
                if (!matchesGrouped[record.video_id]) { // first match for video
                    matchesGrouped[record.video_id] = {
                        video_id: record.video_id,
                        video_title: record.video_title,
                        viewers: []
                    };
                }
                //add usernames that matched
                if (!matchesGrouped[record.video_id].viewers.includes(record.username)) {
                    matchesGrouped[record.video_id].viewers.push(record.username);
                }
            }
        });

        // Convert the object to array of matches
        const matches = Object.values(matchesGrouped);
        return matches;
    } catch (error) {
        console.error('Failed to fetch all matches:', error);
        return [];
    }
}