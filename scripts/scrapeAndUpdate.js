

var { executeScraper } = require('../services/scraper')
var { executeUpdates } = require('../services/guestyUpdates')
var { saveRecord, updateRecord, findRecords } = require('../sequelizer/controller/controller')
const { sequelize } = require("../config/config");

// async function executeScript(token, resortID, suiteType, months, resortFoundorCreated, eventCreated){
async function executeScript(queueType, resortID, suiteType, months, resortFoundorCreated, eventCreated){

    console.log(queueType);
    console.log(resortID);
    console.log(suiteType);
    console.log(months);
    console.log(resortFoundorCreated);
    console.log(eventCreated);
    // var resortJSON = await resortFoundorCreated.toJSON()
    // var resortJSONlistingID = await resortJSON.listingID;
    // var resortHasNoRecord = (resortJSONlistingID === undefined || resortJSONlistingID === null);

    // const scraped = eventCreated !== null ? await executeScraper(
    //     queueType, resortID, suiteType, months, resortHasNoRecord) : null;

    // let success;
    // if ( scraped !== null) {
    //     if (scraped === "MAINTENANCE") {
    //         success = false;
    //         await updateEventStatus(eventCreated, "MAINTENANCE");
    //     } else {
    //         success = await updateGuestyandRecord(resortFoundorCreated, eventCreated, scraped, suiteType, months);
    //     }
    // }  else {
    //     success = false;
    //     await updateEventStatus(eventCreated, "SCRAPE_FAILED");
    // } 

    // return success;

}

async function findOrCreateAResort(resortID, suiteType){

    const resortCond = {
        resortID: resortID,
        unitType: suiteType
    }

    const order = [
        [sequelize.col("resortID"), 'DESC'], 
    ];

    const foundRecords = await findRecords(resortCond, "resorts", order, 1, 0)

    if (foundRecords.length === 0) {
        let recordObject;

        try {
            const resort = {
                resortID: resortID,
                unitType: suiteType
            }

            recordObject = await saveRecord(resort, "resorts");

            return recordObject;
        } catch (error) {
            console.log("Error creating resort");
            return null;
        }
    } else {
        console.log("resort found");
        return foundRecords[0];
    }

}


async function createAnEvent(resortRefNum, months){
    try {
        const event = {
            resortRefNum: resortRefNum,
            execType: "ONE_RESORT",
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



// async function updateGuestyandRecord(resortFoundorCreated, eventCreated, scraped, token, suiteType){
async function updateGuestyandRecord(resortFoundorCreated, eventCreated, scraped, suiteType, months){

    await updateEventStatus(eventCreated, "UPDATING");
    
    options = {
        'Studio': 0,
        '1 Bedroom': 1,
        '2 Bedroom': 2,
        '3 Bedroom': 3,
        '4 Bedroom': 4,
        'Presidential': 5,
        'Hotel Room': 6
    } 

    const address = scraped.address;
    const updatedAvail = scraped.updatedAvail;
    const title = scraped.sElement;

    // let result = await executeUpdates(resortFoundorCreated, token, address, updatedAvail, options[suiteType]);
    let result = await executeUpdates(resortFoundorCreated, address, updatedAvail, options[suiteType], months);

    //call function to update resort and status 
    if (result !== null) {
        try {
            if (result !== "resort already updated"){
                const updateResJson = {
                    resortName: title,
                    listingID: result.listingID,
                    listingName: result.listingName
                }

                await updateRecord(updateResJson, resortFoundorCreated);
            }

            let execStatus = result.success || result === "resort already updated" ? "DONE" : "UPDATE_FAILED";

            await updateEventStatus(eventCreated, execStatus);

            return true;
        } catch (error) {
            console.log("An error occured while updating the records.", error);
            await updateEventStatus(eventCreated, "UPDATE_FAILED");
            return false;
        }

    } else {
        console.log("Guesty calendar update failed.");
        await updateEventStatus(eventCreated, "UPDATE_FAILED");
        return false;
    }

}

async function updateEventStatus(recordObject, status){

    try {
        const updateEventJson = {
            execStatus: status
        } 

        await updateRecord(updateEventJson, recordObject);

        return true;

    } catch (error) {
        console.log("An error occured while updating the status.", error);
        return false;      
    }

}


module.exports = {
    executeScript,
    findOrCreateAResort,
    createAnEvent,
    updateEventStatus
}