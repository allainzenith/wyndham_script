const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require("dotenv").config();

let sharedData = {
    browser: null,
    page: null,
  };

// Make the module an async module
async function globals() {
    const scriptDir = __dirname;
    const customProfileRelPath = 'chrome_profile'; 
    // const customProfileRelPath = 'custom_profile'; 
    const customProfileDir = path.join(scriptDir, customProfileRelPath);
    
    // Check if the custom profile directory exists
    if (!fs.existsSync(customProfileDir)) {
      // If it doesn't exist, create the directory
      fs.mkdirSync(customProfileDir);
    }
    
    // Launch Puppeteer with the custom profile directory
    sharedData.browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        // "--single-process",
        "--no-zygote",
      ],
      // headless: true, 
      headless: 'new',
      userDataDir: customProfileDir
      // executablePath: process.env.NODE_ENV === 'production' 
      //   ? process.env.PUPPETEER_EXECUTABLE_PATH
      //   : puppeteer.executablePath(),
      // userDataDir: process.env.NODE_ENV === 'production' 
      //   ? process.env.CHROMIUM_USER_DATA
      //   : customProfileDir,
    });
    
    // Open a new page
    sharedData.page = await sharedData.browser.newPage();
    sharedData.page.setDefaultNavigationTimeout(120000);

    return sharedData;
}

module.exports = { 
    globals,
    sharedData
};