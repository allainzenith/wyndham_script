const { executeScript, findOrCreateAResort } = require('./oneListing');

const taskQueue = [];
let isProcessing = false;

function processQueue() {
  if (isProcessing) return;
  if (taskQueue.length === 0) return;

  isProcessing = true;
  const { task, args, callback } = taskQueue.shift(); // Get the first task from the queue

  // Execute the task (assuming it's a function)
  task(...args, () => {
    isProcessing = false;
    processQueue(); // Continue processing the queue
    callback();
  });
}

function addToQueue(task, callback, ...args) {
  taskQueue.push({ task, args, callback });
  processQueue(); // Start processing the queue
}

// Example usage:
async function resourceIntensiveTask(token, resortID, suiteType, months, resort, eventCreated, callback) {
  // Perform resource-intensive work
  console.log('resortID: ' + resortID);
  console.log('suiteType: ' + suiteType);
  console.log('months: ' + months);
  
  let executedScript = await executeScript(token, resortID, suiteType, months, resort, eventCreated);
  console.log("Executed Script Successfully: " + executedScript)
  await new Promise(resolve => setTimeout(resolve, 5000));
  callback();
}

module.exports = {
  addToQueue,
  resourceIntensiveTask
}
