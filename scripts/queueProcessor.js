const { executeScript } = require("./scrapeAndUpdate");
const { sharedData } = require("../config/puppeteerOptions");
const { launchPuppeteer, sendOTP } = require("../services/scraper");
const { Worker, isMainThread, workerData } = require('worker_threads');
let oneTimeTaskQueue = [];
let schedTierOneTaskQueue = [];
let schedTierTwoThreeTaskQueue = [];
let isProcessing = false;
let loggedIn = "test"; 
let finishedTasks = 0;
let launch = {
  "ONE TIME": true,
  "TIER 1": true,
  "TIER 2": true,
  "TIER 3": true
}

async function processQueue() {
  if (isProcessing) return;
  if (oneTimeTaskQueue.length === 0) {
    if (launch["ONE TIME"] === false) {
      console.log("No one-time scraping tasks..");
      const browser = sharedData.oneTimeBrowser;
      await browser.close();   
      launch["ONE TIME"] = true;
      finishedTasks++;
      return;  
    }
  }

  if (schedTierOneTaskQueue.length === 0) {
    if (launch["TIER 1"] === false) {
      console.log("No tier 1 scheduled scraping tasks..");
      const browser = sharedData.tierOneBrowser;
      await browser.close();  
      launch["TIER 1"] = true; 
      finishedTasks++; 
      return; 
    }
  }

  if (schedTierTwoThreeTaskQueue.length === 0) {

    if (launch["TIER 2"] === false || launch["TIER 3"] === false) {
      console.log("No tier 2 and 3 scheduled scraping tasks..");
      const browser = sharedData.tierTwoThreeBrowser;
      await browser.close();    
      launch["TIER 2"] = true;
      launch["TIER 3"] = true;
      finishedTasks++;
      return;
    }

  }

  if (finishedTasks === 3) {
    loggedIn = "test";
  }


  isProcessing = true;
  
  if (oneTimeTaskQueue.length > 0) {
    await processTask(oneTimeTaskQueue);
  } 
  
  if (schedTierOneTaskQueue.length > 0) {
    await processTask(schedTierOneTaskQueue);
  }

  if (schedTierTwoThreeTaskQueue.length > 0) {
    await processTask(schedTierTwoThreeTaskQueue);
  }

}

async function processTask(queue) {
  if (loggedIn === "MAINTENANCE" || loggedIn === null) 
  { 
    queue = [];
    processQueue();
  } else {
    const { task, args, callback } = queue.shift();

    // Execute the task (assuming it's a function)
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
      await processQueue();
      resolve(loggedIn);
    } else if (loggedIn === false){
      resolve(loggedIn);
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
          console.log("one time task added")
          break;
        case "TIER 1":
          schedTierOneTaskQueue.push({ task, args, callback });
          break;
        case "TIER 2":
          launch["TIER 3"] = false;
          schedTierTwoThreeTaskQueue.push({ task, args, callback });
        case "TIER 3":
          launch["TIER 2"] = false;
          schedTierTwoThreeTaskQueue.push({ task, args, callback });
      }

      if (launch[taskType]) {
        launch[taskType] = false;
        try {
          console.log("Launching puppeteer now");
          loggedIn = await launchPuppeteer(taskType);
          console.log("This is the logged in variable: ", loggedIn);
   
          try {
            if (loggedIn === true) {
              await processQueue();
            } else if (loggedIn === "MAINTENANCE" || loggedIn === null) {
              await processQueue();
            }
            // Resolve with the final value after everything is done
            resolve(loggedIn);
          } catch (error) {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
          launch[taskType] = true;
          if (taskType === "TIER 2") {
            launch["TIER 3"] = true;
          } else if (taskType === "TIER 3") {
            launch["TIER 2"] = true;
          }
        }

      } else {
        console.log(`Browser for ${taskType} task is already launched. Execution of prior task is ongoing.`);
      }

    } else {
      console.error('Specific argument not provided.');
      resolve(null);
    }

  });
}
// function createWorker(   
//   queueType,
//   resortID,
//   suiteType,
//   months,
//   resort,
//   eventCreated,
//   callback
//   ) {
//   const worker = new Worker('./scripts/worker.js', {
//     workerData: { 
//       queueType,
//       resortID,
//       suiteType,
//       months,
//       resort,
//       eventCreated,
//       callback
//     }
//   });
//   worker.on('message', result => {
//     console.log(`Result for ${queueType}: `, result);
//     worker.terminate();
    
//   });

//   worker.on('exit', (code) => {
//     console.log(`Worker has been terminated with code ${code}`);
//     callback(); 
//   });

//   return worker;
// }

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

  if (queueType === "ONE TIME") {   
    try {
      // Perform resource-intensive work
      let executedScript = await executeScript(
        queueType,
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
    }

  } else {
    const worker = new Worker('./scripts/worker.js', {
      workerData: { 
        queueType : queueType,
        resortID: resortID,
        suiteType: suiteType,
        months: months,
        resort: resort,
        eventCreated: resort
      }
    });
    
    worker.on('message', result => {
      console.log(`Result for ${queueType}: `, result);
      callback(); 
      worker.terminate();
      
    });
  
    worker.on('exit', (code) => {
      console.log(`Worker has been terminated with code ${code}`);
    });
  }

}

module.exports = {
  addToQueue,
  resourceIntensiveTask,
  // addToScheduledQueue,
  processVerification,
};
