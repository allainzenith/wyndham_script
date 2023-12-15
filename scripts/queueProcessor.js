const { executeScript } = require("./scrapeAndUpdate");
const { sharedData } = require("../config/puppeteerOptions");
const { launchPuppeteer, sendOTP } = require("../services/scraper");

let oneTimeTaskQueue = [];
let schedTierOneTaskQueue = [];
let schedTierTwoThreeTaskQueue = [];

let isOneTimeProcessing = false;
let isOneTierProcessing = false;
let isTwoTierProcessing = false;

let oneTimeLoggedIn = "test";
let oneTierLoggedIn = "test";
let twoThreeTierLoggedIn = "test";

let launch = {
  "ONE TIME": true,
  "TIER 1": true,
  "TIER 2": true,
  "TIER 3": true
}

async function processQueue() {
  console.log("queue process function is called")
  if (oneTimeTaskQueue.length === 0 && launch["ONE TIME"] === false && isOneTimeProcessing === false) {
    console.log("No one-time scraping tasks.."); 
    const browser = sharedData.oneTimeBrowser;
    await browser.close(); 
    oneTimeLoggedIn = "test";
    launch["ONE TIME"] = true;
    return;
  }
  
  if (schedTierOneTaskQueue.length === 0 && launch["TIER 1"] === false && isOneTierProcessing === false) {
    console.log("No tier 1 scheduled scraping tasks..");
    const browser = sharedData.tierOneBrowser;
    await browser.close(); 
    oneTierLoggedIn = "test";
    launch["TIER 1"] = true; 
    return;
  }

  if (schedTierTwoThreeTaskQueue.length === 0 && (launch["TIER 2"] === false || launch["TIER 3"] === false) && isTwoTierProcessing === false) {
    console.log("No tier 2 and 3 scheduled scraping tasks..");
    const browser = sharedData.tierTwoThreeBrowser;
    await browser.close(); 
    twoThreeTierLoggedIn = "test";
    launch["TIER 2"] = true;
    launch["TIER 3"] = true;
    return;
  }

  if (oneTimeTaskQueue.length > 0 && isOneTimeProcessing === false && oneTimeLoggedIn !== false) {
    console.log("One time task found..");
    isOneTimeProcessing = true;
    processTask(oneTimeTaskQueue, oneTimeLoggedIn, "ONE TIME");
  }

  if (schedTierOneTaskQueue.length > 0 && isOneTierProcessing === false && oneTierLoggedIn !== false) {
    console.log("One tier task found..");
    isOneTierProcessing = true;
    processTask(schedTierOneTaskQueue, oneTierLoggedIn, "TIER 1");
  }

  if (schedTierTwoThreeTaskQueue.length > 0 && isTwoTierProcessing === false && twoThreeTierLoggedIn !== false) {
    console.log("Two/three tier task found..");
    isTwoTierProcessing = true;
    processTask(schedTierTwoThreeTaskQueue, twoThreeTierLoggedIn, "TIER 2");
  } 

}



function processTask(queue, isLoggedIn, queueType) {
  if (isLoggedIn === "MAINTENANCE" || isLoggedIn === null) 
  { 
    console.log("is logged in: ", isLoggedIn);
    switch(queueType) {
      case "ONE TIME":
        oneTimeTaskQueue = [];
        isOneTimeProcessing = false;
        break;
      case "TIER 1":
        schedTierOneTaskQueue = [];
        isOneTierProcessing = false;
        break;
      case "TIER 2":
      case "TIER 3":
        schedTierTwoThreeTaskQueue = [];
        isTwoTierProcessing = false;
        break;
      default:
        console.error(`Unknown task type for launching puppeteer: ${args[0]}`);
    }
    processQueue();

  } else {
    const { task, args, callback } = queue.shift();

    // Execute the task (assuming it's a function)
    task(...args, () => {
      // isProcessing = false;

      switch(args[0]) {
        case "ONE TIME":
          isOneTimeProcessing = false;
          break;
        case "TIER 1":
          isOneTierProcessing = false;
          break;
        case "TIER 2":
        case "TIER 3":
          isTwoTierProcessing = false;
          break;
        default:
          console.error(`Unknown task type for launching puppeteer: ${args[0]}`);
      }

      processQueue();
      callback();
    });
  }
}

async function processVerification(verOTP, queueType) {
  return new Promise(async(resolve) => {
    let { page, pageForAddress } = await assignPage(queueType);

    switch(queueType) {
      case "ONE TIME":
        oneTimeLoggedIn = await sendOTP(verOTP, queueType, page, pageForAddress);
        resolve(oneTimeLoggedIn);

        await checkIfLoggedIn(oneTimeLoggedIn);
        break;
      case "TIER 1":
        oneTierLoggedIn = await sendOTP(verOTP, queueType, page, pageForAddress);
        resolve(oneTierLoggedIn);

        await checkIfLoggedIn(oneTierLoggedIn);
        break;
      case "TIER 2":
      case "TIER 3":
        twoThreeTierLoggedIn = await sendOTP(verOTP, queueType, page, pageForAddress);
        resolve(twoThreeTierLoggedIn);

        await checkIfLoggedIn(twoThreeTierLoggedIn);
        break;
      default:
        console.error(`Unknown task type for launching puppeteer: ${queueType}`);
        resolve(null);
    }

  });
}

async function addToQueue(task, callback, ...args) {
  return new Promise(async (resolve) => {

    if (args.length > 0) {
      let taskType = args[0]; 

      switch(taskType) {
        case "ONE TIME":
          oneTimeTaskQueue.push({ task, args, callback });
          oneTimeLoggedIn = oneTimeLoggedIn === "test" ? await launchAndLogin(taskType) : oneTimeLoggedIn;

          resolve(oneTimeLoggedIn);

          await checkIfLoggedIn(oneTimeLoggedIn);
          break;
        case "TIER 1":
          schedTierOneTaskQueue.push({ task, args, callback });
          oneTierLoggedIn = oneTierLoggedIn === "test" ? await launchAndLogin(taskType) : oneTierLoggedIn;

          resolve(oneTierLoggedIn);

          await checkIfLoggedIn(oneTierLoggedIn);
          break;
        case "TIER 2":
          launch["TIER 3"] = false;
          schedTierTwoThreeTaskQueue.push({ task, args, callback });
          twoThreeTierLoggedIn = twoThreeTierLoggedIn === "test" ? await launchAndLogin(taskType) : twoThreeTierLoggedIn;

          resolve(twoThreeTierLoggedIn);

          await checkIfLoggedIn(twoThreeTierLoggedIn);
          break;
        case "TIER 3":
          launch["TIER 2"] = false;
          schedTierTwoThreeTaskQueue.push({ task, args, callback });
          twoThreeTierLoggedIn = twoThreeTierLoggedIn === "test" ? await launchAndLogin(taskType) : twoThreeTierLoggedIn;

          resolve(twoThreeTierLoggedIn);

          await checkIfLoggedIn(twoThreeTierLoggedIn);
          break;
        default:
          console.error(`Unknown task type for launching puppeteer: ${taskType}`);
          resolve(null);
      }


    } else {
      console.error('Specific argument not provided.');
      resolve(null);
    }

  });
}

async function checkIfLoggedIn(isLoggedIn) {

  if (isLoggedIn === true || isLoggedIn === "MAINTENANCE" || isLoggedIn === null) {
    await processQueue();
  } 
}

async function launchAndLogin(taskType) {
  if (launch[taskType]) {
    try {
      launch[taskType] = false;
      console.log("Launching puppeteer now");
      let loggedIn = await launchPuppeteer(taskType);

      console.log("This is the logged in variable: ", loggedIn);

      return loggedIn;

    } catch (error) {
      launch[taskType] = true;
      taskType === "TIER 2" ? launch["TIER 3"] : taskType === "TIER 3" ? launch["TIER 2"] : launch[taskType] = true;
      return null;
    }

  } else {
    console.log(`Browser for ${taskType} task is already launched. Execution of prior task is ongoing.`);

  }
}

async function resourceIntensiveTask(
  queueType,
  resortID,
  suiteType,
  months,
  resort,
  eventCreated,
  callback
) {

  console.log("current task:");
  console.log("Resort ID:", resortID);
  console.log("Suite Type:", suiteType);
  console.log("Months:", months);

  let { browser, page, pageForAddress } = await assignPage(queueType);


  let executedScript = await executeScript(
    queueType,
    resortID,
    suiteType,
    months,
    resort,
    eventCreated,
    browser,
    page,
    pageForAddress
  );

  console.log("Executed successfully: ", executedScript);

  callback();
}

async function assignPage(queueType) {
  let browser, page, pageForAddress;

  switch(queueType) {
    case "ONE TIME":
      browser = sharedData.oneTimeBrowser;
      page = sharedData.oneTimePage;
      pageForAddress = sharedData.oneTimeAddressPage;
      break;
    case "TIER 1":
      browser = sharedData.tierOneBrowser;
      page = sharedData.tierOnePage;
      pageForAddress = sharedData.tierOneAddressPage;
      break;
    case "TIER 2":
    case "TIER 3":
      browser = sharedData.tierTwoThreeBrowser;
      page = sharedData.tierTwoThreePage;
      pageForAddress = sharedData.tierTwoThreeAddressPage;
      break;
    default:
      browser = null;
      page = null;
      pageForAddress = null;
  }

  return { browser, page, pageForAddress };
}

module.exports = {
  addToQueue,
  resourceIntensiveTask,
  processVerification,
};
