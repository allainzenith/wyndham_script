const { findRecords } = require('../sequelizer/controller/controller');
const { addToQueue, resourceIntensiveTask } = require('./queueProcessor');
const { saveRecord, bulkSaveRecord } = require('../sequelizer/controller/controller');
const { updateEventStatus } = require('../sequelizer/controller/event.controller');
const { sequelize } = require("../config/config");
const { EventEmitter } = require('events');

const eventEmitter = new EventEmitter();


async function scheduledUpdates(tierType) {

    const order = [
        [sequelize.col("resortID"), 'DESC'], 
        [sequelize.col("unitType"), 'DESC'], 
    ];

    const condJson = {
        notes: tierType
    }

    const allResorts = await findRecords(condJson, "resorts", order, null, null);

    let resortID, suiteType, resortRef;
    let months = 12;
    let allEvents = [];

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
            const matchingItem = batchEvents.find(item2 => item2.resortRefNum === resortRefNum);
            
            // If a matching item is found, merge the properties, otherwise, return the original item from array1
            return matchingItem ? { res: item1, eventCreated: matchingItem } : item1;
        });
    
        console.log("outputing final items now...")

        let displayModal = false;

        for(const {res, eventCreated} of joinedArray){
            addToQueue(resourceIntensiveTask, () => {
                console.log('Task completed');
            }, tierType, res.resortID, res.unitType, months, res, eventCreated)
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

                displayModal = loggedIn === false ? true : false ;
                let execID = eventCreated.execID;

                if (displayModal) {
                    eventEmitter.emit('modalStateChanged', { displayModal, execID });
                }
    
                })
            .catch(error => {
            console.error('Scheduled updates error:', error);
            });

        }

    }

}

module.exports = {
    scheduledUpdates,
    eventEmitter
}