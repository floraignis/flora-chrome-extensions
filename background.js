chrome.action.onClicked.addListener((tab) => {
    if (tab.url.includes("onlyfans.com") || tab.url.includes("fansly.com")) {
        chrome.tabs.sendMessage(tab.id, { action: "toggle_uploader" }, () => {
            if (chrome.runtime.lastError) {
                Promise.all([
                    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }),
                    chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["style.css"] })
                ]).then(() => {
                    chrome.tabs.sendMessage(tab.id, { action: "toggle_uploader" });
                });
            }
        });
    }
});