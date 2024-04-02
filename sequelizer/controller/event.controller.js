const { saveRecord, updateRecord, bulkdeleteRecord } = require('./controller')
const { Op } = require("sequelize");

async function createAnEvent(resortRefNum, period){
    try {
        let event;

        if(period instanceof Date) {
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

async function deleteOldManualUpdates() {
    try {
        // Get the current date
        const currentDate = new Date();

        const condJson ={
            execType: "MANUAL_UDPATE",
            datetoUpdate: {
            [Op.lt]: currentDate 
            }
        }

        await bulkdeleteRecord("execution", condJson);

        return true;

    } catch (error) {
        console.log("An error occured while bulk deleting.", error);
        return false;      
    }   
}

module.exports = {
    createAnEvent,
    updateEventStatus,
    deleteOldManualUpdates
}

