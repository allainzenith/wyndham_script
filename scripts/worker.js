const { workerData, ParentPort } = require("worker_threads");
const { scheduledUpdates } =  require("./scheduledUpdates");


async function task1() {
  const browser = await puppeteer.launch();
  // Your Puppeteer code for task 1 here
  console.log('Executing Task 1');
  await browser.close();
}

async function task2() {
  const browser = await puppeteer.launch();
  // Your Puppeteer code for task 2 here
  console.log('Executing Task 2');
  await browser.close();
}

async function task3() {
  const browser = await puppeteer.launch();
  // Your Puppeteer code for task 3 here
  console.log('Executing Task 3');
  await browser.close();
}

// Listen for messages from the main thread
process.on('message', async message => {
  const { taskType } = message;

  // Call the appropriate function based on the task type
  switch (taskType) {
    case 'TIER 1':
      await task1();
      break;
    case 'TIER 2':
      await task2();
      break;
    case 'TIER 3':
      await task3();
      break;
    default:
      console.error(`Unknown task type: ${taskType}`);
  }

  // Send a message back to the main thread (optional)
  process.send({ result: `Task completed for ${taskType}` });
});

