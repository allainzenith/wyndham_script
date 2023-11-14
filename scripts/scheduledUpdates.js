const { findRecords } = require('../sequelizer/controller/controller');
const { addToScheduledQueue, resourceIntensiveTask } = require('../scripts/queueProcessor');
const { saveRecord } = require('../sequelizer/controller/controller');
const { updateEventStatus } = require('./scrapeAndUpdate');
const { sequelize } = require("../config/config");

async function scheduledUpdates(tierType) {

    const order = [
        [sequelize.col("resortID"), 'DESC'], 
        [sequelize.col("unitType"), 'DESC'], 
    ];

    const condJson = {
        notes: tierType
    }

    const allResorts = await findRecords(condJson, "resorts", order, null, null);

    let resortID, suiteType, eventCreated;
    let months = 12;
    let allEvents = [];

    const itemCounts = {};

    for (const res in allResorts) {
        const item = allResorts[res].listingID;
        if (itemCounts[item]) {
          // This item is a duplicate
          console.log(`Duplicate item found: ${item}`);
        } else {
          // First occurrence of this item
          itemCounts[item] = (itemCounts[item] || 0) + 1;
        }
    }

    console.log("No duplicates found.")

    for(const res of allResorts){

        resortID = res.resortID;
        suiteType = res.unitType;  

        eventCreated = await createAnEvent(res.resortRefNum, months);
        const obj = { res: res, ev: eventCreated };
        allEvents.push(obj);

    }

    console.log("All tasks added to the queue..")

    addToScheduledQueue(resourceIntensiveTask, () => {
        console.log('Task completed');
    }, resortID, suiteType, months, allEvents[0].res, allEvents[0].ev)
    .then(loggedIn => {
        for(const { res, ev } of allEvents) {
            if (loggedIn === true) {
                addToScheduledQueue(resourceIntensiveTask, () => {
                    console.log('Task completed');
                }, resortID, suiteType, months, res, ev);
            } else if (loggedIn === false) {
                updateEventStatus(ev, "UNVERIFIED");
            } else if (loggedIn === "MAINTENANCE") {
                updateEventStatus(ev, "MAINTENANCE");
            } else if (loggedIn === "LOGIN_ERROR") {
                updateEventStatus(ev, "LOGIN_ERROR");
            }
        }

      })
      .catch(error => {
        console.error('Send OTP error:', error);
      });

}


async function createAnEvent(resortRefNum, months){
    try {
        const event = {
            resortRefNum: resortRefNum,
            execType: "SCHEDULED",
            execStatus: "SCRAPING",
            monthstoScrape: parseInt(months)
        }

        recordObject = await saveRecord(event, "execution");

        return recordObject;
    } catch (error) {
        console.log("Error creating event");
        return null;
    }

}


module.exports = {
    scheduledUpdates
}