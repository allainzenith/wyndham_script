const { findRecords } = require('../sequelizer/controller/controller');
const { addToScheduledQueue, resourceIntensiveTask } = require('./queueProcessor');
const { saveRecord, bulkSaveRecord } = require('../sequelizer/controller/controller');
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

    let resortID, suiteType, eventCreated, resortRef;
    let months = 12;
    let allEvents = [], finalItems = [];

    const itemCounts = {};

    for (const res of allResorts) {
        const item = res.listingID;
        if ((itemCounts[item] !== undefined)) {
          // This item is a duplicate
          console.log(`Duplicate item found: ${item}`);
        } else {
            // First occurrence of this item
            itemCounts[item] = (itemCounts[item] || 0) + 1;
            resortID = res.resortID;
            suiteType = res.unitType;  
            resortRef = res.resortRefNum;  

            const event = {
                resortRefNum: resortRef,
                execType: "SCHEDULED",
                execStatus: "SCRAPING",
                monthstoScrape: parseInt(months)
            }
            allEvents.push(event);
        }
    }

    if (allResorts.length === allEvents.length) {
        console.log("No duplicates found.");
        let batchEvents = await bulkSaveRecord(allEvents, "execution");

        const joinedArray = allResorts.map(item1 => {
            const resortRefNum = item1.dataValues.resortRefNum;
            const matchingItem = batchEvents.find(item2 => {
                if (item2.resortRefNum === resortRefNum) {
                    console.log(item2.resortRefNum + " is equal to " + resortRefNum);
                    return true;
                }
            });
            
            // If a matching item is found, merge the properties, otherwise, return the original item from array1
            return matchingItem ? { res: item1, eventCreated: matchingItem } : item1;
        });
    
        console.log("outputing final items now...")

        for(const {res, eventCreated} of joinedArray){
            addToScheduledQueue(resourceIntensiveTask, () => {
                console.log('Task completed');
            }, res.resortID, res.unitType, months, res, eventCreated)
            .then(loggedIn => {
                if (loggedIn === true) {
                    updateEventStatus(eventCreated, "SCRAPING");
                }
                else if (loggedIn === false) {
                    updateEventStatus(eventCreated, "UNVERIFIED");
                } else if (loggedIn === "MAINTENANCE") {
                    updateEventStatus(eventCreated, "MAINTENANCE");
                } else if (loggedIn === null) {
                    updateEventStatus(eventCreated, "LOGIN_ERROR");
                }
    
                })
            .catch(error => {
            console.error('Scheduled updates error:', error);
            });
        }

    }

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