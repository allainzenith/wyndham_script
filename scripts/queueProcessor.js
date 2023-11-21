const { executeScript } = require("./scrapeAndUpdate");
const { sharedData } = require("../config/puppeteerOptions");
const { launchPuppeteer, sendOTP } = require("../services/scraper");

let taskQueue = [];
let scheduledtaskQueue = [];
let isProcessing = false;
let needtolaunchPuppeteer = true;
let loggedIn;

async function processQueue() {
  if (isProcessing) return;
  if (taskQueue.length === 0 && scheduledtaskQueue.length === 0) {
    console.log("All tasks in the queue finished executing..");
    loggedIn = false;
    needtolaunchPuppeteer = true;
    const browser = sharedData.browser;
    await browser.close();
    return;
  }

  isProcessing = true;
  
  if (taskQueue.length > 0) {
    const { task, args, callback } = taskQueue.shift();

    // Execute the task (assuming it's a function)
    task(...args, () => {
      isProcessing = false;
      processQueue();
      callback();
    });
  } else if (scheduledtaskQueue.length > 0) {
    console.log("No ongoing one listing tasks.");
    const { task, args, callback } = scheduledtaskQueue.shift();
  
    task(...args, () => {
      isProcessing = false;
      processQueue();
      callback();
    });
  }

}

async function processVerification(verOTP) {
  return new Promise(async(resolve) => {
    loggedIn = await sendOTP(verOTP);
    console.log("logged in is: ", loggedIn);
    if (loggedIn === true) { 
      await processQueue(); 
    }
    if (loggedIn === "MAINTENANCE" || loggedIn === null) { 
      taskQueue = [];
      await processQueue();
    }

    resolve(loggedIn);
  });
}

async function addToQueue(task, callback, ...args) {
  return new Promise(async(resolve) => {
    if (needtolaunchPuppeteer) {
      needtolaunchPuppeteer = false;
      try {
        console.log("launching puppeteer now");
        loggedIn = await launchPuppeteer();
      } catch (error) {
        resolve(null);
      }
    } else {
      console.log(
        "puppeteer is already launched. execution of prior task is ongoing."
      );
    }

    taskQueue.push({ task, args, callback });

    if (loggedIn === true) { await processQueue() }
    if (loggedIn === "MAINTENANCE" || loggedIn === null) { 
      taskQueue = [];
      await processQueue();
    }

    resolve(loggedIn);
  });
}


async function addToScheduledQueue(task, callback, ...args) {
  return new Promise(async(resolve) => {
    if (needtolaunchPuppeteer) {
      needtolaunchPuppeteer = false;
      try {
        console.log("launching puppeteer now");
        loggedIn = await launchPuppeteer();
      } catch (error) {
        resolve(null);
      }
    } else {
      console.log(
        "puppeteer is already launched. execution of prior task is ongoing."
      );
    }

    scheduledtaskQueue.push({ task, args, callback });

    if (loggedIn === true) { await processQueue() }
    if (loggedIn === "MAINTENANCE" || loggedIn === null) { 
      // scheduledtaskQueue = [];
      await processQueue();
    }

    resolve(loggedIn);
  });

}

async function resourceIntensiveTask(
  resortID,
  suiteType,
  months,
  resort,
  eventCreated,
  callback
) {
  // Perform resource-intensive work

  try {
    console.log("current task:");
    console.log("Resort ID:", resortID);
    console.log("Suite Type:", suiteType);
    console.log("Months:", months);

    let executedScript = await executeScript(
      resortID,
      suiteType,
      months,
      resort,
      eventCreated
    );
    console.log("Executed Script Successfully: " + executedScript);
    callback();
  } catch (error) {
    console.log(error);
    if (taskQueue.length > 0) {
      console.log("relaunching puppeteer now");
      await launchPuppeteer();
    }
  }
}

module.exports = {
  addToQueue,
  resourceIntensiveTask,
  addToScheduledQueue,
  processVerification,
};
