chrome.action.onClicked.addListener((tab) => {
    if (tab.url.includes("onlyfans.com")) {
        chrome.tabs.sendMessage(tab.id, { action: "toggle_uploader" });
    }
});