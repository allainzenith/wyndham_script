const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

let sharedData = {
    browser: null,
    page: null,
  };

// Make the module an async module
async function globals() {
    const scriptDir = __dirname;
    const customProfileRelPath = 'chrome_profile'; 
    const customProfileDir = path.join(scriptDir, customProfileRelPath);
    
    // Check if the custom profile directory exists
    if (!fs.existsSync(customProfileDir)) {
      // If it doesn't exist, create the directory
      fs.mkdirSync(customProfileDir);
    }
    
    // Launch Puppeteer with the custom profile directory
    sharedData.browser = await puppeteer.launch({
      headless: 'new', 
      // headless: false,
      userDataDir: customProfileDir,
    });
    
    // Open a new page
    sharedData.page = await sharedData.browser.newPage();
    sharedData.page.setDefaultNavigationTimeout(60000);

    return sharedData;
}

module.exports = { 
    globals,
    sharedData
};