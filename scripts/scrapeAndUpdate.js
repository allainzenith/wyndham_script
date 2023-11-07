

var { executeScraper } = require('../services/scraper')
var { executeUpdates } = require('../services/guestyUpdates')
var { saveRecord, updateRecord, findRecords } = require('../sequelizer/controller/controller')
const { sequelize } = require("../config/config");

async function executeScript(token, resortID, suiteType, months, resortFoundorCreated, eventCreated){

    console.log("current task executed: ");
    console.log("Resort ID: " + resortID);
    console.log("Unit Type: " + suiteType);
    console.log("Months: " + months);


    var resortJSON = await resortFoundorCreated.toJSON()
    var resortJSONlistingID = await resortJSON.listingID;
    var resortHasNoRecord = (resortJSONlistingID === undefined || resortJSONlistingID === null);

    const scraped = eventCreated !== null ? await executeScraper(
        resortID, suiteType, months, resortHasNoRecord) : null;

    let success;
    if ( scraped !== null) {
        success = await updateGuestyandRecord(resortFoundorCreated, eventCreated, scraped, token, suiteType) 
    }  else {
        success = false;
        await updateEventStatus(eventCreated, "SCRAPE_FAILED");
    } 

    return success;

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



async function updateGuestyandRecord(resortFoundorCreated, eventCreated, scraped, token, suiteType){

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

    let result = await executeUpdates(resortFoundorCreated, token, address, updatedAvail, options[suiteType]);

    //call function to update resort and status 
    if (result !== null) {
        try {
            if (result !== "update resort"){
                const updateResJson = {
                    resortName: title,
                    listingID: result.listingID,
                    listingName: result.listingName
                }

                await updateRecord(updateResJson, resortFoundorCreated);
            }

            await updateEventStatus(eventCreated, "DONE");

            return true;
        } catch (error) {
            console.log("An error occured while updating the records.", error);
            await updateEventStatus(eventCreated, "STATUS_UPDATE_FAILED");
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