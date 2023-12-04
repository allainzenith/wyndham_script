const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require("dotenv").config();

const scriptDir = __dirname;
const customProfileRelPath = 'chrome_profile'; 
const customProfileDir = path.join(scriptDir, customProfileRelPath);

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

    sharedData.oneTimeBrowser = await initializeBrowser(sharedData.oneTimeBrowser);
    sharedData.oneTimePage = await initializePage(sharedData.oneTimePage, sharedData.oneTimeBrowser);
    sharedData.oneTimeAddressPage = await initializePage(sharedData.oneTimeAddressPage, sharedData.oneTimeBrowser);

    return sharedData;
}

async function tierOnePuppeteer() {

  sharedData.tierOneBrowser = await initializeBrowser(sharedData.tierOneBrowser);
  sharedData.tierOnePage = await initializePage(sharedData.tierOnePage, sharedData.tierOneBrowser);
  sharedData.tierOneAddressPage = await initializePage(sharedData.tierOneAddressPage, sharedData.tierOneBrowser);

  return sharedData;
}

async function tierTwoThreePuppeteer() {

  sharedData.tierTwoThreeBrowser = await initializeBrowser(sharedData.tierTwoThreeBrowser);
  sharedData.tierTwoThreePage = await initializePage(sharedData.tierTwoThreePage, sharedData.tierTwoThreeBrowser);
  sharedData.tierTwoThreeAddressPage = await initializePage(sharedData.tierTwoThreeAddressPage, sharedData.tierTwoThreeBrowser);

  return sharedData;
}

async function initializeBrowser(browser) {

  // Check if the custom profile directory exists
  if (!fs.existsSync(customProfileDir)) {
    // If it doesn't exist, create the directory
    fs.mkdirSync(customProfileDir);
  }

  try {
    // Launch Puppeteer with the custom profile directory
    browser = await puppeteer.launch({
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--no-zygote",
      ],
      headless: false, 
      // headless: 'new',
      userDataDir: customProfileDir
    });

    return browser;

  } catch (error) {
    console.log("Launching of puppeteer failed: " + error);
    if(browser !== null){
      await browser.close();
    }

    return null;
  }
}

async function initializePage(page, browser) {
  try {   
    // Open a new page
    page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);

    return page;

  } catch (error) {
    console.log("Launching of puppeteer failed: " + error);
    if(browser !== null){
      await browser.close();
    }

    return null;
  }
}


module.exports = { 
    oneTimeTaskPuppeteer,
    tierOnePuppeteer,
    tierTwoThreePuppeteer,
    sharedData
};