var { findAllRecords } = require('../sequelizer/controller/controller');
var { addToScheduledQueue, resourceIntensiveTask } = require('../scripts/queueProcessor');
var { saveRecord } = require('../sequelizer/controller/controller')
const { sequelize } = require("../config/config");
async function testScheduledUpdates(token) {

    const order = [
        [sequelize.col("resortID"), 'DESC'], 
        [sequelize.col("unitType"), 'DESC'], 
    ];

    const allResorts = await findAllRecords("resorts", order);

    let resortID, suiteType, eventCreated;
    let months = 12;
    for(const res of allResorts){

        resortID = res.resortID;
        suiteType = res.unitType;  

        eventCreated = await createAnEvent(res.resortRefNum, months);
    
        if (eventCreated !== null){
        //first parameter is a callback function
        addToScheduledQueue(resourceIntensiveTask, () => {
            console.log('Moving on to another resort');
        }, token, resortID, suiteType, months, res, eventCreated);
        } else {
            console.log("Creating a resort or execution record failed.")
        }

    }

    console.log("All tasks added to the queue..")
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
    testScheduledUpdates
}