const { findRecords } = require('../sequelizer/controller/controller');
const { addToScheduledQueue, resourceIntensiveTask } = require('../scripts/queueProcessor');
const { saveRecord } = require('../sequelizer/controller/controller')
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
    for(const res of allResorts){

        resortID = res.resortID;
        suiteType = res.unitType;  

        eventCreated = await createAnEvent(res.resortRefNum, months);
    
        if (eventCreated !== null){
        //first parameter is a callback function
        addToScheduledQueue(resourceIntensiveTask, () => {
            console.log('All scheduled tasks executed successfully');
        }, resortID, suiteType, months, res, eventCreated);
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
    scheduledUpdates
}