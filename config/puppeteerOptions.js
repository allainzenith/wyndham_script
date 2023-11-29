const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require("dotenv").config();

const scriptDir = __dirname;
const customProfileRelPath = 'chrome_profile'; 
const customProfileDir = path.join(scriptDir, customProfileRelPath);

let sharedData = {
    browser: null,
    page: null,
    pageForAddress: null,

    browserQueue: null,
    browserTierOne: null,
    browserTierTwoThree: null,

    pageQueue: null,
    pageTierOne: null,
    pageTierTwoThree: null,

    pageForAddressQueue: null,
    pageForAddressTierOne: null,
    pageForAddressTierTwoThree: null,

  };

// Make the module an async module
async function globals() {
    
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

// Make the module an async module
// async function globalsTierOne() {
    
//   // Check if the custom profile directory exists
//   if (!fs.existsSync(customProfileDir)) {
//     // If it doesn't exist, create the directory
//     fs.mkdirSync(customProfileDir);
//   }
  
//   try {
//     // Launch Puppeteer with the custom profile directory
//     sharedData.browserTierOne = await puppeteer.launch({
//       args: [
//         "--disable-setuid-sandbox",
//         "--no-sandbox",
//         "--no-zygote",
//       ],
//       headless: false, 
//       // headless: 'new',
//       userDataDir: customProfileDir
//     });
    
//     // Open a new page
//     sharedData.pageTierOne = await sharedData.browser.newPage();
//     sharedData.pageForAddressTierOne = await sharedData.browser.newPage();
//     sharedData.pageTierOne.setDefaultNavigationTimeout(120000);
//     sharedData.pageForAddressTierOne.setDefaultNavigationTimeout(120000);

//   } catch (error) {
//     console.log("Launching of puppeteer failed: " + error);
//     if(sharedData.browserTierOne !== null){
//       await sharedData.browserTierOne.close();
//     }
//   }

//   return sharedData;
// }

// // Make the module an async module
// async function globalsTierOne() {
    
//   // Check if the custom profile directory exists
//   if (!fs.existsSync(customProfileDir)) {
//     // If it doesn't exist, create the directory
//     fs.mkdirSync(customProfileDir);
//   }
  
//   try {
//     // Launch Puppeteer with the custom profile directory
//     sharedData.browserTierOne = await puppeteer.launch({
//       args: [
//         "--disable-setuid-sandbox",
//         "--no-sandbox",
//         "--no-zygote",
//       ],
//       headless: false, 
//       // headless: 'new',
//       userDataDir: customProfileDir
//     });
    
//     // Open a new page
//     sharedData.pageTierOne = await sharedData.browser.newPage();
//     sharedData.pageForAddressTierOne = await sharedData.browser.newPage();
//     sharedData.pageTierOne.setDefaultNavigationTimeout(120000);
//     sharedData.pageForAddressTierOne.setDefaultNavigationTimeout(120000);

//   } catch (error) {
//     console.log("Launching of puppeteer failed: " + error);
//     if(sharedData.browserTierOne !== null){
//       await sharedData.browserTierOne.close();
//     }
//   }

//   return sharedData;
// }



module.exports = { 
    globals,
    sharedData
};