const { workerData, parentPort } = require("worker_threads");
const { executeScript } = require("./scrapeAndUpdate");

async function scheduled() {


  try {
    const queueType = workerData.queueType;
    const resortID = workerData.resortID;
    const suiteType = workerData.suiteType;
    const months = workerData.months;
    const resort = workerData.resort;
    const eventCreated = workerData.eventCreated;

    let executedScript = await executeScript(
      queueType,
      resortID,
      suiteType,
      months,
      resort,
      eventCreated
    );


    parentPort.postMessage({ result: executedScript });
  } catch (error) {
    console.log(error);
  }
}


scheduled();


