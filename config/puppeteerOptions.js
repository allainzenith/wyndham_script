const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require("dotenv").config();

let sharedData = {
    browser: null,
    page: null,
    pageForAddress: null
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
    

    try {
      // Launch Puppeteer with the custom profile directory
      sharedData.browser = await puppeteer.launch({
        args: [
          "--disable-setuid-sandbox",
          "--no-sandbox",
          "--no-zygote",
        ],
        headless: false, 
        // headless: 'new',
        userDataDir: customProfileDir
      });
      
      // Open a new page
      sharedData.page = await sharedData.browser.newPage();
      sharedData.pageForAddress = await sharedData.browser.newPage();
      sharedData.page.setDefaultNavigationTimeout(120000);
      sharedData.pageForAddress.setDefaultNavigationTimeout(120000);

    } catch (error) {
      console.log("Launching of puppeteer failed: " + error);
      if(sharedData.browser !== null){
        await sharedData.browser.close();
      }
    }

    return sharedData;
}



module.exports = { 
    globals,
    sharedData
};