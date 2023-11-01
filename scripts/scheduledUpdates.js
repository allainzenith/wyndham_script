var { findAllRecords } = require('../sequelizer/controller/controller');
var { addToQueue, resourceIntensiveTask } = require('../scripts/queueProcessor');
var { saveRecord, findRecords } = require('../sequelizer/controller/controller')
const { findOrCreateAResort } = require('../scripts/oneListing');

async function testScheduledUpdates(token) {

    console.log("this is the token: "+ token);

    // const allResorts = await findAllRecords("resorts", "resortID");
    // let resortID, suiteType, resort, eventCreated;
    // let months = 12;
    // for(const res of allResorts){

    //     resortID = res.resortID;
    //     suiteType = res.unitType;  

    //     eventCreated = await createAnEvent(res.resortRefNum, months);
    
    //     if (eventCreated !== null){
    //     //first parameter is a callback function
    //     addToQueue(resourceIntensiveTask, () => {
    //         console.log('Moving on to another resort');
    //     }, token, resortID, suiteType, months, res, eventCreated);
    //     } else {
    //     console.log("Creating a resort or execution record failed.")
    //     }

    // }

    console.log("All scheduled updates finished..")
}

async function createAnEvent(resortRefNum, months){
    try {
        const event = {
            resortRefNum: resortRefNum,
            execType: "ALL_RESORTS",
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