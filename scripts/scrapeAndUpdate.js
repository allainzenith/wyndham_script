

const { executeScraper } = require('../services/scraper')
const { executeUpdates } = require('../services/guestyUpdates')
const { saveRecord, updateRecord, findRecords } = require('../sequelizer/controller/controller')
const { updateEventStatus } = require('../sequelizer/controller/event.controller')
const { sequelize } = require("../config/config");


async function executeScript(queueType, resortID, suiteType, months, resortFoundorCreated, eventCreated, browser, page, pageForAddress){

    // var resortJSON = await resortFoundorCreated.toJSON()
    let resortJSONlistingID = await resortFoundorCreated.listingID;
    let resortHasNoRecord = (resortJSONlistingID === undefined || resortJSONlistingID === null);

    const scraped = eventCreated !== null ? await executeScraper(
        queueType, resortID, suiteType, months, resortHasNoRecord, browser, page, pageForAddress) : null;

    let success;

    if ( scraped !== null) {
        if (scraped === "MAINTENANCE") {
            success = false;
            await updateEventStatus(eventCreated, "MAINTENANCE");
        } else {
            success = await updateGuestyandRecord(resortFoundorCreated, eventCreated, scraped, suiteType, months, page);
        }
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


async function updateGuestyandRecord(resortFoundorCreated, eventCreated, scraped, suiteType, months, page){

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

    let result = await executeUpdates(resortFoundorCreated, address, updatedAvail, options[suiteType], months, page);

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



module.exports = {
    executeScript,
    findOrCreateAResort
}