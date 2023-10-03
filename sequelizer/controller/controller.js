////////////////////////////////////////////////////////////////////////////////
// CONTAINS THE CRUD OPERATIONS WITH THE AID OF METHODS PROVIDED BY SEQUELIZER
////////////////////////////////////////////////////////////////////////////////


//// USE THE SUBSCRIBE FUNCTION TOMORROW
const { execution, resorts } = require('../models/model')

async function saveRecord(recordJson, objectType){
    const typeofObject = (objectType == "execution") ? execution : resorts;

    // create() function instantiates the object and saves it to the database
    try {
        const record = await typeofObject.create(recordJson);
        console.log(JSON.stringify(record, null, 4)); 
        return record;
    } catch (error) {
        console.error("Error saving record: " + error);
        return null;
    }
}

async function findRecords(condJson, objectType){
    const typeofObject = (objectType == "execution") ? execution : resorts;
    return await typeofObject.findAll({
        where: condJson
      });
}

async function updateRecord(recordJson, recordObject){
    // update() function updates fields only specified and makes other fields as-is
    // save() saves the record to the database
    try {
        let newRecord = await recordObject.update(recordJson);
        await recordObject.save();
        console.log("Updated successfully!");
        console.log(JSON.stringify(newRecord, null, 4)); 
        return true;
    } catch (error) {
        console.error("Error updating record: " + error);
        return false;
    }
}

async function deleteRecord(recordObject){
    // destroy() function instantiates the object and saves it to the database
    try {
        await recordObject.destroy();
        console.log("Deleted successfully!");
        return true;
    } catch (error) {
        console.error("Error deleting record: " + error);
        return false;
    }
}

module.exports = {
    saveRecord,
    findRecords,
    deleteRecord,
    updateRecord
}

