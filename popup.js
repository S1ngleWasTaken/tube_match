chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'username'], (result) => { // sets defaul input values
    supaUrl = result.supabaseUrl;
    supaKey = result.supabaseKey;
    username = result.username;

    if (username === undefined) {
        document.getElementById('usernameInput').value = '';
    } else {
        document.getElementById('usernameInput').value = username;
    }

    if (supaUrl === undefined) {
        document.getElementById('urlInput').value = '';
    } else {
        document.getElementById('urlInput').value = supaUrl;
    }
    
    if (supaKey === undefined) {
        document.getElementById('keyInput').value = '';
    } else {
        document.getElementById('keyInput').value = supaKey;
    }
})

document.getElementById('saveButton').addEventListener('click', () => { //saves supabase url and key to local storage
    const dbUrl = document.getElementById('urlInput').value;
    const dbKey = document.getElementById('keyInput').value;
    const username = document.getElementById('usernameInput').value;

    chrome.storage.local.set({ supabaseUrl: dbUrl, supabaseKey: dbKey, username: username }, () => {
        //save button confirmation
        document.getElementById('saveButton').textContent = 'Saved';
        setTimeout(() => {
            document.getElementById('saveButton').textContent = 'Save';
        }, 2000);
    });
})