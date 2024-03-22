const { saveRecord, updateRecord } = require('./controller')

async function createAnEvent(resortRefNum, period){
    try {
        let event;

        if(isNaN(period)) {
            event = {
                resortRefNum: resortRefNum,
                execType: "MANUAL_UPDATE",
                execStatus: "UPDATING",
                datetoUpdate : period
            }
        }
        else {
            event = {
                resortRefNum: resortRefNum,
                execType: "ONE_RESORT",
                execStatus: "SCRAPING",
                monthstoScrape : parseInt(period)
            }
        }
        recordObject = await saveRecord(event, "execution");

        return recordObject;
    } catch (error) {
        console.log("Error creating event", error.message);
        return null;
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
    createAnEvent,
    updateEventStatus
}

