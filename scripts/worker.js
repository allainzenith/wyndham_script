const { workerData, parentPort } = require("worker_threads");
const { executeScript } = require("./scrapeAndUpdate");
const { launchPuppeteer } = require("../services/scraper");
const { sharedData } = require("../config/puppeteerOptions");

// Create the browser and page instances
let browser, page, pageForAddress;

async function scheduled() {
  // try {
  //   const queueType = workerData.queueType;
  //   const resortID = workerData.resortID;
  //   const suiteType = workerData.suiteType;
  //   const months = workerData.months;
  //   const resort = workerData.resort;
  //   const eventCreated = workerData.eventCreated;

  //   if (browser !== undefined && page !== undefined && pageForAddress !== undefined) {
  //     let executedScript = await executeScript(
  //       queueType,
  //       resortID,
  //       suiteType,
  //       months,
  //       resort,
  //       eventCreated,
  //       browser,
  //       page,
  //       pageForAddress
  //     );

  //     parentPort.postMessage({ result: executedScript });
  //   } else {
  //     console.log('UNDEFINED GIHAPON');
  //   }

  // } catch (error) {
  //   console.log(error);
  // }

  // const queueType = workerData.queueType;
  // const queueLength = workerData.queueLength;

  

  // if (browser === undefined || page === undefined || pageForAddress === undefined) {
  //   console.log("launching because browser and pages are undefined")
  //   await launchPuppeteer(queueType);
  // } else {
  //   console.log("Browser and pages already defined for this task type.")
  //   browser = sharedData.oneTimeBrowser;
  //   page = sharedData.oneTimePage;
  //   pageForAddress = sharedData.oneTimeAddressPage;
  // }

  // switch(queueType) {
  //   case "ONE TIME":

  //     console.log(browser);
  //     console.log(page);
  //     console.log(pageForAddress);

  //     if (queueLength === 0) {
  //       await browser.close();
  //     }

  //     break;
  //   case "TIER 1":
  //     browser = sharedData.tierOneBrowser;
  //     page = sharedData.tierOnePage;
  //     pageForAddress = sharedData.tierOneAddressPage;
  //     break;
  //   case "TIER 2":
  //   case "TIER 3":
  //     browser = sharedData.tierTwoThreeBrowser;
  //     page = sharedData.tierTwoThreePage; 
  //     pageForAddress = sharedData.tierTwoThreeAddressPage;
  //     break;
  //   default:
  //     console.error(`Unknown task type for launching puppeteer: ${taskType}`);
  // }

  parentPort.postMessage({ result: true });
}

// Invoke scheduled function only if it's not being required as a module
if (require.main === module) {
  scheduled();
}




