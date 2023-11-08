const { executeScript } = require("./scrapeAndUpdate");
const { sharedData } = require("../config/puppeteerOptions");
const { launchPuppeteer } = require("../services/scraper");

const taskQueue = [];
const scheduledtaskQueue = [];
let isProcessing = false;
let needtolaunchPuppeteer = true;

async function processQueue() {
  if (isProcessing) return;
  if (taskQueue.length === 0 && scheduledtaskQueue.length === 0) {
    const browser = sharedData.browser;
    await browser.close();
    needtolaunchPuppeteer = true;
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


async function addToQueue(task, callback, ...args) {
  if (needtolaunchPuppeteer) {
    needtolaunchPuppeteer = false;
    console.log("launching puppeteer now");
    await launchPuppeteer();
  } else {
    console.log(
      "puppeteer is already launched. execution of prior task is ongoing."
    );
  }
  taskQueue.push({ task, args, callback });
  await processQueue();
}

async function addToScheduledQueue(task, callback, ...args) {
  if (needtolaunchPuppeteer) {
    needtolaunchPuppeteer = false;
    console.log("launching puppeteer now");
    await launchPuppeteer();
  } else {
    console.log(
      "puppeteer is already launched. execution of prior task is ongoing."
    );
  }
  scheduledtaskQueue.push({ task, args, callback });
  await processQueue();
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
  console.log("resortID: " + resortID);
  console.log("suiteType: " + suiteType);
  console.log("months: " + months);

  try {
    let executedScript = await executeScript(
      resortID,
      suiteType,
      months,
      resort,
      eventCreated
    );
    console.log("Executed Script Successfully: " + executedScript);
    await new Promise((resolve) => setTimeout(resolve, 5000));
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
  addToScheduledQueue
};
