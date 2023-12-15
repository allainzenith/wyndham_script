const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require("dotenv").config();

const scriptDir = __dirname;
// const customProfileRelPath = 'chrome_profile'; 


let sharedData = {
  oneTimeBrowser: null,
  oneTimePage: null,
  oneTimeAddressPage: null,

  tierOneBrowser: null,
  tierOnePage: null,
  tierOneAddressPage: null,

  tierTwoThreeBrowser: null,
  tierTwoThreePage: null,
  tierTwoThreeAddressPage: null,

  };

// Make the module an async module
async function oneTimeTaskPuppeteer() {

    sharedData.oneTimeBrowser = await initializeBrowser("chrome_one_time");
    sharedData.oneTimePage = await initializePage(sharedData.oneTimePage, sharedData.oneTimeBrowser);
    sharedData.oneTimeAddressPage = await initializePage(sharedData.oneTimeAddressPage, sharedData.oneTimeBrowser);

    return sharedData;
}

async function tierOnePuppeteer() {

  sharedData.tierOneBrowser = await initializeBrowser("chrome_one_tier");
  sharedData.tierOnePage = await initializePage(sharedData.tierOnePage, sharedData.tierOneBrowser);
  sharedData.tierOneAddressPage = await initializePage(sharedData.tierOneAddressPage, sharedData.tierOneBrowser);

  return sharedData;
}

async function tierTwoThreePuppeteer() {

  sharedData.tierTwoThreeBrowser = await initializeBrowser("chrome_two_tier");
  sharedData.tierTwoThreePage = await initializePage(sharedData.tierTwoThreePage, sharedData.tierTwoThreeBrowser);
  sharedData.tierTwoThreeAddressPage = await initializePage(sharedData.tierTwoThreeAddressPage, sharedData.tierTwoThreeBrowser);

  return sharedData;
}

async function initializeBrowser(customProfileRelPath) {
  const customProfileDir = path.join(scriptDir, customProfileRelPath);

  if (!fs.existsSync(customProfileDir)) {
    fs.mkdirSync(customProfileDir);
  }


  let newBrowser;

  try {
    // Launch Puppeteer with the custom profile directory
    newBrowser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--no-sandbox",
        "--no-zygote",
      ],
      headless: false, 
      // headless: 'new',
      userDataDir: customProfileDir
    });

    return newBrowser;

  } catch (error) {
    console.error("Error during initialization:", error.message);
    throw new Error("Initialization failed: " + error.message);
  }
  
}

async function initializePage(page, browser) {
  try {   
    // Open a new page
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);

    return page;

  } catch (error) {
    console.error("Error during initialization:", error.message);
    throw new Error("Initialization failed: " + error.message);
  }
  
}



module.exports = { 
    oneTimeTaskPuppeteer,
    tierOnePuppeteer,
    tierTwoThreePuppeteer,
    sharedData
};