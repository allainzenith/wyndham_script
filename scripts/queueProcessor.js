const { executeScript } = require("./scrapeAndUpdate");
const { sharedData } = require("../config/puppeteerOptions");
const { launchPuppeteer, sendOTP } = require("../services/scraper");

let taskQueue = [];
let scheduledTaskQueue = [];
let isProcessing = false;
let needToLaunchPuppeteer = true;
let loggedIn = "test";

async function processQueue() {
  if (isProcessing) return;
  if (taskQueue.length === 0 && scheduledTaskQueue.length === 0) {
    console.log("All tasks in the queue finished executing..");
    loggedIn = "test";
    needToLaunchPuppeteer = true;
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
  } else if (scheduledTaskQueue.length > 0) {
    console.log("No ongoing one listing tasks.");
    const { task, args, callback } = scheduledTaskQueue.shift();
  
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
      resolve(loggedIn);
    }
    else if (loggedIn === "MAINTENANCE" || loggedIn === null) { 
      taskQueue = [];
      await processQueue();
      resolve(loggedIn);
    } else if (loggedIn === false){
      resolve(loggedIn);
    }

  });
}

async function addToQueue(task, callback, ...args) {
  return new Promise(async (resolve) => {
    if (needToLaunchPuppeteer) {
      needToLaunchPuppeteer = false;
      try {
        console.log("Launching puppeteer now");
        loggedIn = await launchPuppeteer();
      } catch (error) {
        resolve(null);
      }
    } else {
      console.log("Puppeteer is already launched. Execution of prior task is ongoing.");
    }

    taskQueue.push({ task, args, callback });

    // Wait for the asynchronous operations to complete
    try {
      if (loggedIn === true) {
        await processQueue();
      } else if (loggedIn === "MAINTENANCE" || loggedIn === null) {
        taskQueue = [];
        await processQueue();
      }
      // Resolve with the final value after everything is done
      resolve(loggedIn);
    } catch (error) {
      resolve(null);
    }
  });
}

async function addToScheduledQueue(task, callback, ...args) {
  return new Promise(async (resolve) => {

    scheduledTaskQueue.push({ task, args, callback });

    if (needToLaunchPuppeteer) {
      needToLaunchPuppeteer = false;
      try {
        console.log("Launching puppeteer now");
        loggedIn = await launchPuppeteer();
      } catch (error) {
        resolve(null);
        return; // Exit early if there's an error launching Puppeteer
      }
    } else {
      console.log("Puppeteer is already launched. Execution of prior task is ongoing.");
    }

    // Wait for the asynchronous operations to complete
    try {
      if (loggedIn === true) {
        await processQueue();
      } else if (loggedIn === "MAINTENANCE" || loggedIn === null) {
        scheduledTaskQueue = [];
        await processQueue();
      }
      // Resolve with the final value after everything is done
      resolve(loggedIn);
    } catch (error) {
      resolve(null);
    }
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
